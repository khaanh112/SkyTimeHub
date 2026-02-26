import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@entities/leave-request-notification-recipient.entity';
import { LeaveRequestItem } from '@entities/leave-request-item.entity';
import { LeaveBalanceTransaction } from '@entities/leave-balance-transaction.entity';
import { LeaveType } from '@entities/leave-type.entity';
import { LeaveCategory } from '@entities/leave-category.entity';
import { LeaveTypePolicy } from '@entities/leave-type-policy.entity';
import { LeaveTypeConversion } from '@entities/leave-type-conversion.entity';
import { CalendarOverride } from '@entities/calendar-override.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { User } from '@entities/users.entity';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveRequest,
      LeaveRequestNotificationRecipient,
      LeaveRequestItem,
      LeaveBalanceTransaction,
      LeaveType,
      LeaveCategory,
      LeaveTypePolicy,
      LeaveTypeConversion,
      CalendarOverride,
      UserApprover,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, LeaveBalanceService],
  exports: [LeaveRequestsService, LeaveBalanceService],
})
export class LeaveRequestsModule {}
