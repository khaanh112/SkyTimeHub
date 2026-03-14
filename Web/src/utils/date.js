import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const VN_TZ = 'Asia/Ho_Chi_Minh';

/** Today's date string YYYY-MM-DD in VN timezone */
export const vnTodayStr = () => dayjs().tz(VN_TZ).format('YYYY-MM-DD');

/** Current year in VN timezone */
export const vnYear = () => dayjs().tz(VN_TZ).year();

/** Current month in VN timezone (1-based) */
export const vnMonth = () => dayjs().tz(VN_TZ).month() + 1;

/** Format a date value as DD/MM/YYYY (VN display format) */
export const fmtDate = (val) =>
  val ? dayjs(val).tz(VN_TZ).format('DD/MM/YYYY') : '';

/** Format a date-time value as DD/MM/YYYY HH:mm (VN display format) */
export const fmtDateTime = (val) =>
  val ? dayjs(val).tz(VN_TZ).format('DD/MM/YYYY HH:mm') : '';

/** Extract YYYY-MM-DD for <input type="date"> from any date value */
export const toInputDate = (val) =>
  val ? dayjs(val).tz(VN_TZ).format('YYYY-MM-DD') : '';

/** Extract HH:mm for <input type="time"> from any date value */
export const toInputTime = (val) =>
  val ? dayjs(val).tz(VN_TZ).format('HH:mm') : '';

/** Extract YYYY-MM-DDTHH:mm for <input type="datetime-local"> from any date value */
export const toInputDateTime = (val) =>
  val ? dayjs(val).tz(VN_TZ).format('YYYY-MM-DDTHH:mm') : '';

export { dayjs, VN_TZ as default };
