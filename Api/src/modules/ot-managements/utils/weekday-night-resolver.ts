import { Repository } from 'typeorm';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { OtDayTypeOutput } from '@/common/enums/ot-day-type.enum';
import { OtCheckinItem } from '@/entities/ot-checkin-item.entity';

/**
 * Determine the display subtype for a WEEKDAY_NIGHT segment.
 *
 * If the employee has any approved WEEKDAY (day-time) OT check-in item
 * attributed to the same date, the night segment is classified as
 * WITH_DAY_OT (higher rate); otherwise NO_DAY_OT.
 *
 * This is computed at report/export time and is NEVER stored in the database.
 */
export async function resolveWeekdayNightSubtype(
  employeeId: number,
  attributedDate: string,
  checkinItemRepo: Repository<OtCheckinItem>,
): Promise<OtDayTypeOutput.WEEKDAY_NIGHT_NO_DAY_OT | OtDayTypeOutput.WEEKDAY_NIGHT_WITH_DAY_OT> {
  const count = await checkinItemRepo.count({
    where: { employeeId, attributedDate, dayType: OtDayType.WEEKDAY },
  });

  return count > 0
    ? OtDayTypeOutput.WEEKDAY_NIGHT_WITH_DAY_OT
    : OtDayTypeOutput.WEEKDAY_NIGHT_NO_DAY_OT;
}
