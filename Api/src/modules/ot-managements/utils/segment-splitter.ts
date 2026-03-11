import { Repository } from 'typeorm';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { resolveDayType } from './day-type-resolver';

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

const DAY_START_HOUR = 6;  // 06:00 local time
const DAY_END_HOUR   = 22; // 22:00 local time

function isNightHour(date: Date): boolean {
  const h = date.getHours();
  return h < DAY_START_HOUR || h >= DAY_END_HOUR;
}

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add `days` days to an ISO date string and return a new ISO date string. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

/**
 * Split the interval [start, end) at midnight, 06:00, and 22:00 boundaries
 * (local time) and resolve the OtDayType for each resulting sub-segment.
 *
 * Each segment's `attributedDate` is initialized to its `actualDate`;
 * call `applyCarryOver` afterwards to enforce daily caps.
 */
export async function splitIntoSegments(
  start: Date,
  end: Date,
  calendarRepo: Repository<CalendarOverride>,
): Promise<OtSegment[]> {
  const cuts = new Set<number>();
  cuts.add(start.getTime());
  cuts.add(end.getTime());

  // Walk day by day from midnight of the start date, inserting 06:00 / 22:00 / midnight
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() < end.getTime()) {
    const sixAm = new Date(cursor); sixAm.setHours(DAY_START_HOUR, 0, 0, 0);
    const tenPm = new Date(cursor); tenPm.setHours(DAY_END_HOUR, 0, 0, 0);
    const nextMidnight = new Date(cursor); nextMidnight.setDate(nextMidnight.getDate() + 1); nextMidnight.setHours(0, 0, 0, 0);

    for (const b of [sixAm, tenPm, nextMidnight]) {
      const t = b.getTime();
      if (t > start.getTime() && t < end.getTime()) cuts.add(t);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const sorted = [...cuts].sort((a, b) => a - b).map(t => new Date(t));

  const segments: OtSegment[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i];
    const segEnd   = sorted[i + 1];
    const durationMinutes = Math.round((segEnd.getTime() - segStart.getTime()) / 60_000);
    if (durationMinutes <= 0) continue;

    const actualDate = localDateString(segStart);
    const baseDayType = await resolveDayType(segStart, calendarRepo);
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
async function getDailyCap(dateStr: string, calendarRepo: Repository<CalendarOverride>): Promise<number> {
  const probe = new Date(`${dateStr}T12:00:00`);
  const baseDayType = await resolveDayType(probe, calendarRepo);
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
 */
export async function applyCarryOver(
  segments: OtSegment[],
  calendarRepo: Repository<CalendarOverride>,
): Promise<OtSegment[]> {
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
    const cap     = await getDailyCap(dateStr, calendarRepo);

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
