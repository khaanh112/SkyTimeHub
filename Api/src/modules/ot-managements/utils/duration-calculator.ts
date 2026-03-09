import { OtTimeType } from '@/common/enums/ot-time-type.enum';

/**
 * Compute duration in minutes between two timestamps.
 */
export function computeDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Determine OT time type based on the time range.
 * Day: 06:00-22:00
 * Night: 22:00-06:00
 * Mixed: spans both day and night periods
 */
export function resolveOtTimeType(startTime: Date, endTime: Date): OtTimeType {
  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;

  const DAY_START = 6;
  const DAY_END = 22;

  // Check if the range is entirely within daytime
  const isEntirelyDay = startHour >= DAY_START && endHour <= DAY_END;

  // Check if the range is entirely within nighttime
  const isEntirelyNight =
    (startHour >= DAY_END || startHour < DAY_START) && (endHour > DAY_END || endHour <= DAY_START);

  if (isEntirelyDay) {
    return OtTimeType.DAY;
  }

  if (isEntirelyNight) {
    return OtTimeType.NIGHT;
  }

  return OtTimeType.MIXED;
}
