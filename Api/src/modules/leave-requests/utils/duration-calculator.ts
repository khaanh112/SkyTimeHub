/**
 * Leave Duration Calculator
 *
 * Calculates leave duration in half-day (0.5) steps, correctly handling:
 * - AM/PM sessions
 * - Weekends (Sat/Sun)
 * - Public holidays (from calendar_overrides)
 * - Working override days (weekend days that are workdays)
 */

import { Repository } from 'typeorm';
import { CalendarOverride } from '@entities/calendar-override.entity';
import { LeaveSession } from '@/common/enums/leave-session.enum';

/** Check if a date is Sat or Sun */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Format Date to 'YYYY-MM-DD' using local time (not UTC) */
function fmt(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface DurationResult {
  /** Duration in days (0.5 step) */
  durationDays: number;
  /** Number of half-day slots */
  slots: number;
}

/**
 * Calculate calendar days (every day counts, including weekends/holidays).
 * Uses same AM/PM session logic as working-day calculator.
 */
export function calculateCalendarDuration(
  startDate: string,
  endDate: string,
  startSession: LeaveSession,
  endSession: LeaveSession,
): DurationResult {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  let totalSlots = 0;
  const current = new Date(start);

  while (current <= end) {
    const isSameAsStart = fmt(current) === startDate;
    const isSameAsEnd = fmt(current) === endDate;

    let amCounts = true;
    let pmCounts = true;

    if (isSameAsStart && startSession === LeaveSession.PM) amCounts = false;
    if (isSameAsEnd && endSession === LeaveSession.AM) pmCounts = false;

    if (amCounts) totalSlots++;
    if (pmCounts) totalSlots++;

    current.setDate(current.getDate() + 1);
  }

  return {
    durationDays: totalSlots * 0.5,
    slots: totalSlots,
  };
}

/**
 * Auto-calculate end date from start date + N calendar days (including weekends/holidays).
 * Used for parental leave (maternity) where calendar days are counted.
 */
export function calculateCalendarEndDate(
  startDate: string,
  startSession: LeaveSession,
  calendarDays: number,
): { endDate: string; endSession: LeaveSession } {
  let remainingSlots = calendarDays * 2;
  const current = new Date(startDate + 'T00:00:00');
  let lastDate = current;
  let lastSlot: LeaveSession = startSession;

  while (remainingSlots > 0) {
    const isFirst = fmt(current) === startDate;

    // AM slot
    const amAvailable = !(isFirst && startSession === LeaveSession.PM);
    if (amAvailable && remainingSlots > 0) {
      remainingSlots--;
      lastDate = new Date(current);
      lastSlot = LeaveSession.AM;
    }

    // PM slot
    if (remainingSlots > 0) {
      remainingSlots--;
      lastDate = new Date(current);
      lastSlot = LeaveSession.PM;
    }

    if (remainingSlots > 0) {
      current.setDate(current.getDate() + 1);
    } else {
      break;
    }
  }

  return {
    endDate: fmt(lastDate),
    endSession: lastSlot,
  };
}

/**
 * Calculate leave duration in days (half-day granularity).
 *
 * Each working day has 2 slots: AM and PM.
 * - Start AM + End PM on same day = 1 day
 * - Start AM + End AM on same day = 0.5 day
 * - Start PM + End PM on same day = 0.5 day
 *
 * Non-working days (weekends + holidays, except working overrides) are skipped.
 */
export async function calculateLeaveDuration(
  leaveTypeId: number,
  calendarRepo: Repository<CalendarOverride>,
  startDate: string,
  endDate: string,
  startSession: LeaveSession,
  endSession: LeaveSession,
): Promise<DurationResult> {

  
  // Load calendar overrides for the date range
  const overrides = await calendarRepo
    .createQueryBuilder('co')
    .where('co.date >= :start AND co.date <= :end', { start: startDate, end: endDate })
    .getMany();

  const holidaySet = new Set<string>();
  const workingOverrideSet = new Set<string>();

  for (const o of overrides) {
    const d = typeof o.date === 'string' ? o.date : fmt(new Date(o.date));
    if (o.type === 'HOLIDAY') holidaySet.add(d);
    if (o.type === 'WORKING_OVERRIDE') workingOverrideSet.add(d);
  }

  /** Is this date a working day? */
  function isWorkingDay(date: Date): boolean {
    const key = fmt(date);
    // Explicit holiday → not working
    if (holidaySet.has(key)) return false;
    // Explicit working override (e.g. Saturday make-up) → working
    if (workingOverrideSet.has(key)) return true;
    // Normal weekend → not working
    if (isWeekend(date)) return false;
    // Normal weekday → working
    return true;
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  let totalSlots = 0;
  const current = new Date(start);

  while (current <= end) {
    if (isWorkingDay(current)) {
      const isSameAsStart = fmt(current) === startDate;
      const isSameAsEnd = fmt(current) === endDate;

      // Determine which slots count on this day
      let amCounts = true;
      let pmCounts = true;

      // If this is the start day and session is PM, AM doesn't count
      if (isSameAsStart && startSession === LeaveSession.PM) {
        amCounts = false;
      }
      // If this is the end day and session is AM, PM doesn't count
      if (isSameAsEnd && endSession === LeaveSession.AM) {
        pmCounts = false;
      }

      if (amCounts) totalSlots++;
      if (pmCounts) totalSlots++;
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    durationDays: totalSlots * 0.5,
    slots: totalSlots,
  };
}

/**
 * Auto-calculate end date from start date + max days, skipping non-working days.
 * Used for Policy / Social Benefits leave types with auto_calculate_end_date = true.
 *
 * @returns { endDate, endSession }
 */
export async function autoCalculateEndDate(
  calendarRepo: Repository<CalendarOverride>,
  startDate: string,
  startSession: LeaveSession,
  maxDays: number,
): Promise<{ endDate: string; endSession: LeaveSession }> {
  // Load holidays for a generous range (maxDays * 2 to account for weekends/holidays)
  const rangeEnd = new Date(startDate + 'T00:00:00');
  rangeEnd.setDate(rangeEnd.getDate() + Math.ceil(maxDays * 3));

  const overrides = await calendarRepo
    .createQueryBuilder('co')
    .where('co.date >= :start AND co.date <= :end', {
      start: startDate,
      end: fmt(rangeEnd),
    })
    .getMany();

  const holidaySet = new Set<string>();
  const workingOverrideSet = new Set<string>();

  for (const o of overrides) {
    const d = typeof o.date === 'string' ? o.date : fmt(new Date(o.date));
    if (o.type === 'HOLIDAY') holidaySet.add(d);
    if (o.type === 'WORKING_OVERRIDE') workingOverrideSet.add(d);
  }

  function isWorkingDay(date: Date): boolean {
    const key = fmt(date);
    if (holidaySet.has(key)) return false;
    if (workingOverrideSet.has(key)) return true;
    if (isWeekend(date)) return false;
    return true;
  }

  // Total half-day slots to allocate
  let remainingSlots = maxDays * 2; // e.g. 3 days = 6 slots

  const current = new Date(startDate + 'T00:00:00');
  let lastWorkingDate = current;
  let lastSlot: LeaveSession = startSession;

  // If start session is PM, the start day only has 1 slot (PM)
  // If start session is AM, the start day has 2 slots (AM + PM)
  while (remainingSlots > 0) {
    if (isWorkingDay(current)) {
      const isFirst = fmt(current) === startDate;

      // AM slot
      const amAvailable = !(isFirst && startSession === LeaveSession.PM);
      if (amAvailable && remainingSlots > 0) {
        remainingSlots--;
        lastWorkingDate = new Date(current);
        lastSlot = LeaveSession.AM;
      }

      // PM slot
      if (remainingSlots > 0) {
        remainingSlots--;
        lastWorkingDate = new Date(current);
        lastSlot = LeaveSession.PM;
      }
    }

    if (remainingSlots > 0) {
      current.setDate(current.getDate() + 1);
    } else {
      break;
    }
  }

  return {
    endDate: fmt(lastWorkingDate),
    endSession: lastSlot,
  };
}
