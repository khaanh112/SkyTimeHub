import { In, Repository } from 'typeorm';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { CalendarOverrideType } from '@/common/enums/calendar-override-type.enum';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { vnDateStr, vnDayOfWeek, vnParseDateStr } from '@/common/utils/date.util';

/**
 * Resolve the OT day type for a given date by checking:
 * 1. CalendarOverride for HOLIDAY -> HOLIDAY
 * 2. CalendarOverride for WORKING_OVERRIDE -> WEEKDAY (even if Sat/Sun)
 * 3. Day of week: Sat/Sun -> WEEKEND
 * 4. Default: WEEKDAY
 *
 * Date operations use VN timezone (Asia/Ho_Chi_Minh).
 */
export async function resolveDayType(
  date: Date,
  calendarRepo: Repository<CalendarOverride>,
): Promise<OtDayType> {
  const dateStr = vnDateStr(date); // YYYY-MM-DD in VN timezone

  const override = await calendarRepo.findOne({
    where: { date: dateStr },
  });

  if (override) {
    if (override.type === CalendarOverrideType.HOLIDAY) {
      return OtDayType.HOLIDAY;
    }
    if (override.type === CalendarOverrideType.WORKING_OVERRIDE) {
      return OtDayType.WEEKDAY;
    }
  }

  const dayOfWeek = vnDayOfWeek(date); // 0=Sun, 6=Sat in VN timezone
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return OtDayType.WEEKEND;
  }

  return OtDayType.WEEKDAY;
}

/**
 * Resolve an OtDayType from an already-built cache (synchronous, no DB call).
 * Falls back to WEEKDAY if the date is not in the cache.
 */
export function resolveDayTypeFromCache(dateStr: string, cache: Map<string, OtDayType>): OtDayType {
  return cache.get(dateStr) ?? OtDayType.WEEKDAY;
}

/**
 * Pre-load day types for multiple YYYY-MM-DD strings in a SINGLE DB query.
 * Pass the resulting map to splitIntoSegments / applyCarryOver to avoid N+1 queries.
 */
export async function buildDayTypeCache(
  dateStrings: string[],
  calendarRepo: Repository<CalendarOverride>,
): Promise<Map<string, OtDayType>> {
  if (dateStrings.length === 0) return new Map();

  const overrides = await calendarRepo.findBy({ date: In(dateStrings) });
  const overrideMap = new Map(overrides.map((o) => [o.date, o.type]));

  const cache = new Map<string, OtDayType>();
  for (const dateStr of dateStrings) {
    const overrideType = overrideMap.get(dateStr);
    if (overrideType === CalendarOverrideType.HOLIDAY) {
      cache.set(dateStr, OtDayType.HOLIDAY);
    } else if (overrideType === CalendarOverrideType.WORKING_OVERRIDE) {
      cache.set(dateStr, OtDayType.WEEKDAY);
    } else {
      const dow = vnDayOfWeek(vnParseDateStr(dateStr));
      cache.set(dateStr, dow === 0 || dow === 6 ? OtDayType.WEEKEND : OtDayType.WEEKDAY);
    }
  }
  return cache;
}
