import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '@entities/users.entity';
import { RefreshToken } from '@entities/refresh-token.entity';
import { Department } from '@entities/departments.entity';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@entities/leave-request-notification-recipient.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { EmailQueue } from '@entities/email_queue.entity';
import { LeaveCategory } from '@entities/leave-category.entity';
import { LeaveType } from '@entities/leave-type.entity';
import { LeaveTypePolicy } from '@entities/leave-type-policy.entity';
import { LeaveTypeConversion } from '@entities/leave-type-conversion.entity';
import { LeaveRequestItem } from '@entities/leave-request-item.entity';
import { LeaveBalanceTransaction } from '@entities/leave-balance-transaction.entity';
import { LeaveRequestAttachment } from '@entities/leave-request-attachment.entity';
import { CalendarOverride } from '@entities/calendar-override.entity';
import { CompWorkRequest } from '@entities/comp-work-request.entity';
import { CompBalanceTransaction } from '@entities/comp-balance-transaction.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  entities: [
    // Core
    User,
    RefreshToken,
    Department,
    UserApprover,
    EmailQueue,
    // Leave system
    LeaveCategory,
    LeaveType,
    LeaveTypePolicy,
    LeaveTypeConversion,
    LeaveRequest,
    LeaveRequestItem,
    LeaveRequestNotificationRecipient,
    LeaveRequestAttachment,
    LeaveBalanceTransaction,
    // Calendar
    CalendarOverride,
    // Compensatory
    CompWorkRequest,
    CompBalanceTransaction,
  ],
  synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
  logging: configService.get('DB_LOGGING') === 'true',
});
