import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '@entities/users.entity';
import { RefreshToken } from '@entities/refresh-token.entity';
import { Department } from '@entities/departments.entity';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@entities/leave-request-notification-recipient.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { EmailQueue } from '@entities/email_queue.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  entities: [User, RefreshToken, Department, LeaveRequest, LeaveRequestNotificationRecipient, UserApprover, EmailQueue],
  synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
  logging: configService.get('DB_LOGGING') === 'true',
});
