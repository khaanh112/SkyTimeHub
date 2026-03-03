import { Module } from '@nestjs/common';
import { UserApproverService } from './services/user-approver.service';
import { UserApproverController } from './controller/user-approver.controller';
import { HolidayCalendarService } from './services/holiday-calendar.service';
import { HolidayCalendarController } from './controller/holiday-calendar.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserApprover } from '@/entities/user_approver.entity';
import { User } from '@/entities/users.entity';
import { CalendarOverride } from '@/entities/calendar-override.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserApprover, User, CalendarOverride])],
  providers: [UserApproverService, HolidayCalendarService],
  controllers: [UserApproverController, HolidayCalendarController],
  exports: [UserApproverService, HolidayCalendarService],
})
export class SettingsModule {}
