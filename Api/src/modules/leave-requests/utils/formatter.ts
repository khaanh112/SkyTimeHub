/**
 * Build an ISO-like datetime string from date + session.
 * AM start = 08:30, PM start = 13:30
 * AM end   = 12:00, PM end   = 17:30
 */
export function buildDateTime(date: string, session: string, type: 'start' | 'end'): string {
  let time: string;
  if (type === 'start') {
    time = session === 'AM' ? '08:30:00' : '13:30:00';
  } else {
    time = session === 'AM' ? '12:00:00' : '17:30:00';
  }
  // Return ISO with +07:00 timezone offset
  return `${date}T${time}+07:00`;
}

/**
 * Convert durationDays (numeric, 0.5 step) to a human label.
 * 0.5 → "0.5 Day", 1 → "1 Day", 2 → "2 Days", etc.
 */
export function buildDurationLabel(durationDays: number | null): string {
  if (durationDays == null) return '0 Days';
  const d = Number(durationDays);
  if (d <= 1) return `${d} Day`;
  return `${d} Days`;
}
