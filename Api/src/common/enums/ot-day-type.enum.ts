export enum OtDayType {
  WEEKDAY = 'weekday',
  WEEKDAY_NIGHT = 'weekday_night',
  WEEKEND = 'weekend',
  WEEKEND_NIGHT = 'weekend_night',
  HOLIDAY = 'holiday',
  HOLIDAY_NIGHT = 'holiday_night',
}

/** Computed subtypes for WEEKDAY_NIGHT — used in reports/exports only, NEVER stored in DB */
export enum OtDayTypeOutput {
  WEEKDAY_NIGHT_NO_DAY_OT = 'weekday_night_no_day_ot',
  WEEKDAY_NIGHT_WITH_DAY_OT = 'weekday_night_with_day_ot',
}
