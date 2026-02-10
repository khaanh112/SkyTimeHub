import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@entities/leave-request-notification-recipient.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { User } from '@entities/users.entity';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, LeaveRequestNotificationRecipient, UserApprover, User]),
    NotificationsModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
