import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const VN_TZ = 'Asia/Ho_Chi_Minh';

/** Current time as dayjs object in VN timezone */
export const vnNow = () => dayjs().tz(VN_TZ);

/** Today's date string YYYY-MM-DD in VN timezone */
export const vnTodayStr = () => dayjs().tz(VN_TZ).format('YYYY-MM-DD');

/** Current year in VN timezone */
export const vnYear = () => dayjs().tz(VN_TZ).year();

/** Current month in VN timezone (1-based) */
export const vnMonth = () => dayjs().tz(VN_TZ).month() + 1;

/** Convert any Date/string to dayjs in VN timezone */
export const toVN = (date: Date | string) => dayjs(date).tz(VN_TZ);

/** Get hour (0-23) of a Date in VN timezone */
export const vnHour = (date: Date) => dayjs(date).tz(VN_TZ).hour();

/** Get day-of-week (0=Sun..6=Sat) of a Date in VN timezone */
export const vnDayOfWeek = (date: Date) => dayjs(date).tz(VN_TZ).day();

/** Format a Date as YYYY-MM-DD string using VN timezone */
export const vnDateStr = (date: Date) => dayjs(date).tz(VN_TZ).format('YYYY-MM-DD');

/** Start of day (midnight VN time) for a date, returned as Date (UTC) */
export const vnStartOfDay = (date: Date) =>
  dayjs(date).tz(VN_TZ).startOf('day').toDate();

/** Set specific hour on a date in VN timezone (minute/second/ms = 0), returned as Date (UTC) */
export const vnSetHour = (date: Date, hour: number) =>
  dayjs(date).tz(VN_TZ).hour(hour).minute(0).second(0).millisecond(0).toDate();

/** Add days to a YYYY-MM-DD date string and return new YYYY-MM-DD string */
export const addDaysToStr = (dateStr: string, days: number): string =>
  dayjs(dateStr).add(days, 'day').format('YYYY-MM-DD');

/**
 * Parse a YYYY-MM-DD date string as noon VN time, returning a Date (UTC).
 * Use this when you need a Date object that unambiguously falls on the given
 * calendar date in VN timezone (e.g. for day-type probing via resolveDayType).
 */
export const vnParseDateStr = (dateStr: string): Date =>
  dayjs.tz(dateStr, 'YYYY-MM-DD', VN_TZ).hour(12).toDate();

/** Parse a YYYY-MM-DD string as start-of-day in VN timezone → UTC Date, for >= query bounds */
export const vnStartOfDayFromStr = (dateStr: string): Date =>
  dayjs.tz(dateStr, 'YYYY-MM-DD', VN_TZ).startOf('day').toDate();

/** Parse a YYYY-MM-DD string as end-of-day in VN timezone → UTC Date, for <= query bounds */
export const vnEndOfDayFromStr = (dateStr: string): Date =>
  dayjs.tz(dateStr, 'YYYY-MM-DD', VN_TZ).endOf('day').toDate();

/**
 * Parse a YYYY-MM-DD string into { year, month, day } numbers.
 * Pure string splitting — no Date/timezone involved.
 */
export const parseDateParts = (
  dateStr: string,
): { year: number; month: number; day: number } => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
};

/**
 * Format { year, month, day } back to YYYY-MM-DD string.
 */
export const fmtDateParts = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/**
 * Add months to a YYYY-MM-DD date string using dayjs (handles month overflow).
 * Returns YYYY-MM-DD string.
 */
export const addMonthsToStr = (dateStr: string, months: number): string =>
  dayjs(dateStr).add(months, 'month').format('YYYY-MM-DD');

/**
 * Compute difference in calendar days between two YYYY-MM-DD strings.
 * Result is (end - start) in days.
 */
export const diffDaysStr = (startStr: string, endStr: string): number =>
  dayjs(endStr).diff(dayjs(startStr), 'day');

/** Re-export dayjs (with utc + timezone plugins already applied) */
export { dayjs };
