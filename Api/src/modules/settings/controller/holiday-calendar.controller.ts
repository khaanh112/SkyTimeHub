import { Controller, Get, Put, Query, Body, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Roles } from '@/modules/authorization/decorators/roles.decorator';
import { UserRole } from '@/common';
import { HolidayCalendarService, HolidayResponse } from '../services/holiday-calendar.service';
import { SaveHolidayCalendarDto } from '../dto/holiday-calendar.dto';
import { diffDaysStr } from '@/common/utils/date.util';

@ApiBearerAuth()
@Controller('settings/holiday-calendar')
export class HolidayCalendarController {
  constructor(private readonly holidayCalendarService: HolidayCalendarService) {}

  @ApiOperation({ summary: 'Get holidays for a specific year' })
  @ApiQuery({ name: 'year', type: Number, example: 2026 })
  @ApiResponse({ status: 200, description: 'Holidays retrieved successfully.' })
  @Get()
  async getHolidays(
    @Query('year', ParseIntPipe) year: number,
  ): Promise<{ holidays: HolidayResponse[]; totalDays: number }> {
    const [holidays, totalDays] = await Promise.all([
      this.holidayCalendarService.getHolidaysByYear(year),
      this.holidayCalendarService.getTotalHolidayDays(year),
    ]);
    return { holidays, totalDays };
  }

  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Save holiday calendar for a year' })
  @ApiResponse({ status: 200, description: 'Holiday calendar saved successfully.' })
  @Put()
  async saveHolidayCalendar(
    @Body() dto: SaveHolidayCalendarDto,
  ): Promise<{ holidays: HolidayResponse[]; totalDays: number }> {
    const holidays = await this.holidayCalendarService.saveHolidayCalendar(dto);

    // Calculate total days from the saved holidays
    let totalDays = 0;
    for (const holiday of holidays) {
      totalDays += diffDaysStr(holiday.startDate, holiday.endDate) + 1;
    }

    return { holidays, totalDays };
  }
}
