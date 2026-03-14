import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { resolveDayTypeFromCache } from './day-type-resolver';
import { vnHour, vnDateStr, vnStartOfDay, vnSetHour, addDaysToStr } from '@/common/utils/date.util';

export interface OtSegment {
  dayType: OtDayType;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  /** Physical calendar date the segment starts on (HR reference). Never changes. */
  actualDate: string;
  /** Accounting date credited to the employee.  Starts equal to actualDate; may change after applyCarryOver. */
  attributedDate: string;
}

const DAY_START_HOUR = 6;  // 06:00 VN time
const DAY_END_HOUR   = 22; // 22:00 VN time

function isNightHour(date: Date): boolean {
  const h = vnHour(date);
  return h < DAY_START_HOUR || h >= DAY_END_HOUR;
}

/** Add `days` days to an ISO date string and return a new ISO date string. */
export function addDays(dateStr: string, days: number): string {
  return addDaysToStr(dateStr, days);
}

/**
 * Split the interval [start, end) at midnight, 06:00, and 22:00 boundaries
 * (VN time) and resolve the OtDayType for each resulting sub-segment.
 *
 * Each segment's `attributedDate` is initialized to its `actualDate`;
 * call `applyCarryOver` afterwards to enforce daily caps.
 *
 * @param dayTypeCache - pre-built via buildDayTypeCache() covering all dates in [start, end+N]
 */
export function splitIntoSegments(
  start: Date,
  end: Date,
  dayTypeCache: Map<string, OtDayType>,
): OtSegment[] {
  const cuts = new Set<number>();
  cuts.add(start.getTime());
  cuts.add(end.getTime());

  // Walk day by day from midnight of the start date (VN time), inserting 06:00 / 22:00 / midnight
  let cursor = vnStartOfDay(start);

  while (cursor.getTime() < end.getTime()) {
    const sixAm       = vnSetHour(cursor, DAY_START_HOUR);
    const tenPm       = vnSetHour(cursor, DAY_END_HOUR);
    const nextMidnight = vnStartOfDay(new Date(cursor.getTime() + 24 * 60 * 60 * 1000));

    for (const b of [sixAm, tenPm, nextMidnight]) {
      const t = b.getTime();
      if (t > start.getTime() && t < end.getTime()) cuts.add(t);
    }
    cursor = nextMidnight;
  }

  const sorted = [...cuts].sort((a, b) => a - b).map((t) => new Date(t));

  const segments: OtSegment[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i];
    const segEnd   = sorted[i + 1];
    const durationMinutes = Math.round((segEnd.getTime() - segStart.getTime()) / 60_000);
    if (durationMinutes <= 0) continue;

    const actualDate  = vnDateStr(segStart);
    const baseDayType = resolveDayTypeFromCache(actualDate, dayTypeCache);
    const night       = isNightHour(segStart);

    let dayType: OtDayType;
    if (night) {
      switch (baseDayType) {
        case OtDayType.WEEKDAY: dayType = OtDayType.WEEKDAY_NIGHT; break;
        case OtDayType.WEEKEND: dayType = OtDayType.WEEKEND_NIGHT; break;
        case OtDayType.HOLIDAY: dayType = OtDayType.HOLIDAY_NIGHT; break;
        default: dayType = OtDayType.WEEKDAY_NIGHT;
      }
    } else {
      dayType = baseDayType;
    }

    segments.push({ dayType, startTime: segStart, endTime: segEnd, durationMinutes, actualDate, attributedDate: actualDate });
  }

  return segments;
}

/**
 * Resolve the daily cap (minutes) for a given date string.
 * WEEKDAY → 240 min (4 h); WEEKEND / HOLIDAY → 480 min (8 h).
 */
function getDailyCap(dateStr: string, dayTypeCache: Map<string, OtDayType>): number {
  const baseDayType = resolveDayTypeFromCache(dateStr, dayTypeCache);
  return baseDayType === OtDayType.WEEKDAY ? 240 : 480;
}

/**
 * Enforce per-date daily caps and chain overflow to the next calendar date.
 *
 * - WEEKDAY (and WEEKDAY_NIGHT) attributed to the same date share a 240-min cap.
 * - WEEKEND_* / HOLIDAY_* share a 480-min cap.
 * - Segments that push a date over its cap are split at the exact cap boundary;
 *   the overflow portion is moved to attributedDate + 1 day and re-evaluated.
 * - Chaining continues until all attributed dates are within their caps.
 *
 * Note: `actualDate` is never modified — it always records the physical date.
 *
 * @param dayTypeCache - pre-built via buildDayTypeCache(); dates not in cache fall back to WEEKDAY cap
 */
export function applyCarryOver(
  segments: OtSegment[],
  dayTypeCache: Map<string, OtDayType>,
): OtSegment[] {
  // Build an ordered list of attributed dates with their segments
  const dateOrder: string[] = [];
  const dateMap = new Map<string, OtSegment[]>();

  for (const seg of segments) {
    if (!dateMap.has(seg.attributedDate)) {
      dateOrder.push(seg.attributedDate);
      dateMap.set(seg.attributedDate, []);
    }
    dateMap.get(seg.attributedDate)!.push({ ...seg });
  }

  // Sort each group chronologically
  for (const segs of dateMap.values()) {
    segs.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  // Also sort dateOrder chronologically
  dateOrder.sort();

  // Process each date in order, propagating overflow forward
  for (let di = 0; di < dateOrder.length; di++) {
    const dateStr = dateOrder[di];
    const daySegs = dateMap.get(dateStr)!;
    const cap     = getDailyCap(dateStr, dayTypeCache);

    let accumulated = 0;
    const kept: OtSegment[]     = [];
    const overflow: OtSegment[] = [];

    for (const seg of daySegs) {
      if (accumulated >= cap) {
        overflow.push({ ...seg, attributedDate: addDays(dateStr, 1) });
        continue;
      }

      const remaining = cap - accumulated;
      if (seg.durationMinutes <= remaining) {
        kept.push(seg);
        accumulated += seg.durationMinutes;
      } else {
        // Split: first `remaining` minutes stay, the rest overflow
        const splitPoint = new Date(seg.startTime.getTime() + remaining * 60_000);

        kept.push({ ...seg, endTime: splitPoint, durationMinutes: remaining });
        accumulated += remaining;

        overflow.push({
          ...seg,
          startTime:       splitPoint,
          durationMinutes: seg.durationMinutes - remaining,
          attributedDate:  addDays(dateStr, 1),
        });
      }
    }

    dateMap.set(dateStr, kept);

    if (overflow.length > 0) {
      const nextDate = addDays(dateStr, 1);

      // Ensure next date exists in dateOrder and dateMap
      const nextIdx = di + 1;
      if (nextIdx >= dateOrder.length || dateOrder[nextIdx] !== nextDate) {
        dateOrder.splice(nextIdx, 0, nextDate);
        dateMap.set(nextDate, []);
      }

      // Merge overflow with existing segments of nextDate and re-sort
      const nextSegs = dateMap.get(nextDate)!;
      dateMap.set(
        nextDate,
        [...overflow, ...nextSegs].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
      );
    }
  }

  // Flatten back to a single array ordered by attributed date then start time
  const result: OtSegment[] = [];
  for (const dateStr of dateOrder) {
    result.push(...(dateMap.get(dateStr) ?? []));
  }
  return result;
}

// ─── Monthly carry-over helpers ─────────────────────────────

function yearMonthKey(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${m}`;
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-1` : `${y}-${m + 1}`;
}

function firstOfNextMonthDate(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (m === 12) return `${y + 1}-01-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/**
 * Enforce per-month caps and chain overflow to the first day of the next month.
 *
 * Runs AFTER `applyCarryOver` (daily). When a month's total (existing balance +
 * new segments) exceeds `monthlyCap`, overflow segments get their
 * `attributedDate` set to the first day of the following month. Chaining
 * continues until all months are within their caps.
 *
 * @param segments        - segments already processed by `applyCarryOver`
 * @param existingMonthlyBalance - "YYYY-M" → net minutes already recorded for that month
 * @param monthlyCap      - max minutes per month (default 2400 = 40 h)
 */
export function applyMonthlyCarryOver(
  segments: OtSegment[],
  existingMonthlyBalance: Map<string, number>,
  monthlyCap: number = 2_400,
): OtSegment[] {
  if (segments.length === 0) return [];

  const workingMap = new Map(existingMonthlyBalance);

  const monthOrder: string[] = [];
  const monthMap = new Map<string, OtSegment[]>();

  for (const seg of segments) {
    const key = yearMonthKey(seg.attributedDate);
    if (!monthMap.has(key)) {
      monthOrder.push(key);
      monthMap.set(key, []);
    }
    monthMap.get(key)!.push({ ...seg });
  }

  monthOrder.sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  });

  for (const segs of monthMap.values()) {
    segs.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  for (let mi = 0; mi < monthOrder.length; mi++) {
    const key = monthOrder[mi];
    const segs = monthMap.get(key)!;
    const existing = workingMap.get(key) ?? 0;
    let remaining = monthlyCap - existing;

    if (remaining <= 0) {
      const nKey = nextMonthKey(key);
      const nDate = firstOfNextMonthDate(key);
      const overflow = segs.map(s => ({ ...s, attributedDate: nDate }));
      monthMap.set(key, []);

      if (!monthMap.has(nKey)) {
        monthOrder.splice(mi + 1, 0, nKey);
        monthMap.set(nKey, []);
      }
      const nextSegs = monthMap.get(nKey)!;
      monthMap.set(
        nKey,
        [...overflow, ...nextSegs].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
      );
      continue;
    }

    let accumulated = 0;
    const kept: OtSegment[] = [];
    const overflow: OtSegment[] = [];

    for (const seg of segs) {
      if (accumulated >= remaining) {
        overflow.push(seg);
        continue;
      }
      const space = remaining - accumulated;
      if (seg.durationMinutes <= space) {
        kept.push(seg);
        accumulated += seg.durationMinutes;
      } else {
        const splitPoint = new Date(seg.startTime.getTime() + space * 60_000);
        kept.push({ ...seg, endTime: splitPoint, durationMinutes: space });
        accumulated += space;
        overflow.push({
          ...seg,
          startTime: splitPoint,
          durationMinutes: seg.durationMinutes - space,
        });
      }
    }

    workingMap.set(key, existing + accumulated);
    monthMap.set(key, kept);

    if (overflow.length > 0) {
      const nKey = nextMonthKey(key);
      const nDate = firstOfNextMonthDate(key);
      const overflowMoved = overflow.map(s => ({ ...s, attributedDate: nDate }));

      if (!monthMap.has(nKey)) {
        monthOrder.splice(mi + 1, 0, nKey);
        monthMap.set(nKey, []);
      }
      const nextSegs = monthMap.get(nKey)!;
      monthMap.set(
        nKey,
        [...overflowMoved, ...nextSegs].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
      );
    }
  }

  const result: OtSegment[] = [];
  for (const key of monthOrder) {
    result.push(...(monthMap.get(key) ?? []));
  }
  return result;
}
