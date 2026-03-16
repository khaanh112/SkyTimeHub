import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtManagementsController } from './ot-managements.controller';
import { OtManagementsService } from './ot-managements.service';
import { OtBalanceService } from './ot-balance.service';
import { OtReportService } from './ot-report.service';
import { OtPlan } from '@/entities/ot-plan.entity';
import { OtPlanEmployee } from '@/entities/ot-plan-employee.entity';
import { OtCheckin } from '@/entities/ot-checkin.entity';
import { OtCheckinItem } from '@/entities/ot-checkin-item.entity';
import { OtType } from '@/entities/ot-type.entity';
import { OtBalanceTransaction } from '@/entities/ot-balance-transaction.entity';
import { User } from '@/entities/users.entity';
import { Department } from '@/entities/departments.entity';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { SystemSetting } from '@/entities/system-setting.entity';
import { CompBalanceTransaction } from '@/entities/comp-balance-transaction.entity';
import { LeaveRequest } from '@/entities/leave_request.entity';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OtPlan,
      OtPlanEmployee,
      OtCheckin,
      OtCheckinItem,
      OtType,
      OtBalanceTransaction,
      User,
      Department,
      CalendarOverride,
      SystemSetting,
      CompBalanceTransaction,
      LeaveRequest,
    ]),
    NotificationsModule,
  ],
  controllers: [OtManagementsController],
  providers: [OtManagementsService, OtBalanceService, OtReportService],
  exports: [OtManagementsService, OtBalanceService, OtReportService],
})
export class OtManagementsModule {}
