import { Repository } from 'typeorm';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { CalendarOverrideType } from '@/common/enums/calendar-override-type.enum';
import { OtDayType } from '@/common/enums/ot-day-type.enum';

/**
 * Resolve the OT day type for a given date by checking:
 * 1. CalendarOverride for HOLIDAY -> HOLIDAY
 * 2. CalendarOverride for WORKING_OVERRIDE -> WEEKDAY (even if Sat/Sun)
 * 3. Day of week: Sat/Sun -> WEEKEND
 * 4. Default: WEEKDAY
 */
export async function resolveDayType(
  date: Date,
  calendarRepo: Repository<CalendarOverride>,
): Promise<OtDayType> {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

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

  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return OtDayType.WEEKEND;
  }

  return OtDayType.WEEKDAY;
}
