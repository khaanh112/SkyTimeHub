import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { CalendarOverrideType } from '@/common/enums/calendar-override-type.enum';
import { SaveHolidayCalendarDto, HolidayItemDto } from '../dto/holiday-calendar.dto';
import { AppException } from '@/common';
import { ErrorCode } from '@/common/enums/errror-code.enum';

export interface HolidayResponse {
  name: string;
  startDate: string;
  endDate: string;
  compensatoryDate: string | null;
}

/**
 * Safely convert a DB date value (string or Date object) to 'YYYY-MM-DD' string.
 * PostgreSQL `date` columns may return either depending on driver settings.
 */
function toDateStr(value: string | Date): string {
  if (typeof value === 'string') {
    // Already 'YYYY-MM-DD' or 'YYYY-MM-DDT...' → take the date part
    return value.substring(0, 10);
  }
  // Date object → format using local timezone (safe, same approach as duration-calculator)
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generate an array of 'YYYY-MM-DD' strings for every day in [startDate, endDate].
 * Uses date-part arithmetic only — no timezone issues.
 */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  // Parse date parts directly to avoid timezone shifts
  const [sY, sM, sD] = startDate.split('-').map(Number);
  const [eY, eM, eD] = endDate.split('-').map(Number);

  const current = new Date(sY, sM - 1, sD); // local midnight
  const end = new Date(eY, eM - 1, eD);

  while (current <= end) {
    dates.push(toDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

@Injectable()
export class HolidayCalendarService {
  private readonly logger = new Logger(HolidayCalendarService.name);

  constructor(
    @InjectRepository(CalendarOverride)
    private readonly calendarOverrideRepository: Repository<CalendarOverride>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all holidays for a given year, grouped by name.
   * DB stores one row per day; API returns grouped start/end per holiday name.
   */
  async getHolidaysByYear(year: number): Promise<HolidayResponse[]> {
    this.logger.log(`Fetching holidays for year: ${year}`);

    const records = await this.calendarOverrideRepository.find({
      where: { year },
      order: { date: 'ASC' },
    });

    // Group by name → merge individual day rows into { startDate, endDate }
    const holidayMap = new Map<
      string,
      { holidayDates: string[]; compensatoryDate: string | null }
    >();

    for (const record of records) {
      const name = (record.name || 'Unnamed Holiday').trim();
      const dateStr = toDateStr(record.date);

      if (!holidayMap.has(name)) {
        holidayMap.set(name, { holidayDates: [], compensatoryDate: null });
      }

      const entry = holidayMap.get(name)!;

      if (record.type === CalendarOverrideType.HOLIDAY) {
        entry.holidayDates.push(dateStr);
      } else if (record.type === CalendarOverrideType.WORKING_OVERRIDE) {
        entry.compensatoryDate = dateStr;
      }
    }

    const holidays: HolidayResponse[] = [];
    for (const [name, data] of holidayMap.entries()) {
      if (data.holidayDates.length === 0) continue;

      // Dates are already 'YYYY-MM-DD' strings → lexicographic sort is correct
      const sortedDates = data.holidayDates.sort();
      holidays.push({
        name,
        startDate: sortedDates[0],
        endDate: sortedDates[sortedDates.length - 1],
        compensatoryDate: data.compensatoryDate,
      });
    }

    return holidays;
  }

  /**
   * Count total holiday days for a year
   */
  async getTotalHolidayDays(year: number): Promise<number> {
    const count = await this.calendarOverrideRepository.count({
      where: { year, type: CalendarOverrideType.HOLIDAY },
    });
    return count;
  }

  /**
   * Save/replace all holidays for a given year.
   * Frontend sends { name, startDate, endDate } → service expands to individual day rows.
   */
  async saveHolidayCalendar(dto: SaveHolidayCalendarDto): Promise<HolidayResponse[]> {
    this.logger.log(`Saving holiday calendar for year: ${dto.year}`);

    // Validate holidays
    this.validateHolidays(dto.holidays, dto.year);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete all existing entries for this year
      await queryRunner.manager.delete(CalendarOverride, { year: dto.year });

      // Create new entries — expand each holiday range into individual day rows
      const entities: CalendarOverride[] = [];

      for (const holiday of dto.holidays) {
        // Generate all dates in [startDate, endDate] using safe local-date arithmetic
        const dateRange = generateDateRange(holiday.startDate, holiday.endDate);

        for (const dateStr of dateRange) {
          const entity = queryRunner.manager.create(CalendarOverride, {
            date: dateStr,
            type: CalendarOverrideType.HOLIDAY,
            name: holiday.name,
            year: dto.year,
          });
          entities.push(entity);
        }

        // Add compensatory day if provided
        if (holiday.compensatoryDate) {
          const compEntity = queryRunner.manager.create(CalendarOverride, {
            date: holiday.compensatoryDate,
            type: CalendarOverrideType.WORKING_OVERRIDE,
            name: holiday.name,
            year: dto.year,
          });
          entities.push(compEntity);
        }
      }

      // Check for duplicate dates
      const dateSet = new Set<string>();
      for (const entity of entities) {
        if (dateSet.has(entity.date)) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            `Duplicate date found: ${entity.date}. Each date can only appear once in the calendar.`,
            400,
          );
        }
        dateSet.add(entity.date);
      }

      if (entities.length > 0) {
        await queryRunner.manager.save(CalendarOverride, entities);
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Successfully saved ${entities.length} calendar entries for year ${dto.year}`,
      );

      return this.getHolidaysByYear(dto.year);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to save holiday calendar for year ${dto.year}`,
        error?.stack ?? String(error),
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate holiday items before saving
   */
  private validateHolidays(holidays: HolidayItemDto[], year: number): void {
    const nameSet = new Set<string>();

    for (const holiday of holidays) {
      // Check for duplicate holiday names
      if (nameSet.has(holiday.name.trim().toLowerCase())) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `Duplicate holiday name: "${holiday.name}". Each holiday must have a unique name.`,
          400,
        );
      }
      nameSet.add(holiday.name.trim().toLowerCase());

      // Validate dates
      const startDate = new Date(holiday.startDate);
      const endDate = new Date(holiday.endDate);

      if (isNaN(startDate.getTime())) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `Invalid start date for holiday "${holiday.name}".`,
          400,
        );
      }

      if (isNaN(endDate.getTime())) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `Invalid end date for holiday "${holiday.name}".`,
          400,
        );
      }

      // End date must not be earlier than start date
      if (endDate < startDate) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `End date cannot be earlier than start date for holiday "${holiday.name}".`,
          400,
        );
      }

      // Duration must be non-negative (already guaranteed by endDate >= startDate)
      const diffDays =
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays < 0) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `Holiday duration must be non-negative for "${holiday.name}".`,
          400,
        );
      }

      // Check that dates belong to the correct year
      if (startDate.getFullYear() !== year) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `Start date for "${holiday.name}" must be in year ${year}.`,
          400,
        );
      }

      if (endDate.getFullYear() !== year) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          `End date for "${holiday.name}" must be in year ${year}.`,
          400,
        );
      }

      // Validate compensatory date if provided
      if (holiday.compensatoryDate) {
        const compDate = new Date(holiday.compensatoryDate);
        if (isNaN(compDate.getTime())) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            `Invalid compensatory date for holiday "${holiday.name}".`,
            400,
          );
        }

        // Compensatory date should be in the same year
        if (compDate.getFullYear() !== year) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            `Compensatory date for "${holiday.name}" must be in year ${year}.`,
            400,
          );
        }

        // Compensatory date should be on a weekend (Saturday or Sunday)
        const dayOfWeek = compDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            `Compensatory date for "${holiday.name}" must be on a weekend (Saturday or Sunday).`,
            400,
          );
        }
      }
    }
  }
}
