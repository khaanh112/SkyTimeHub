import { Module } from '@nestjs/common';
import { UserApproverService } from './services/user-approver.service';
import { UserApproverController } from './controller/user-approver.controller';
import { HolidayCalendarService } from './services/holiday-calendar.service';
import { HolidayCalendarController } from './controller/holiday-calendar.controller';
import { PolicySettingsService } from './services/policy-settings.service';
import { PolicySettingsController } from './controller/policy-settings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserApprover } from '@/entities/user_approver.entity';
import { User } from '@/entities/users.entity';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { SystemSetting } from '@/entities/system-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserApprover, User, CalendarOverride, SystemSetting])],
  providers: [UserApproverService, HolidayCalendarService, PolicySettingsService],
  controllers: [UserApproverController, HolidayCalendarController, PolicySettingsController],
  exports: [UserApproverService, HolidayCalendarService, PolicySettingsService],
})
export class SettingsModule {}
