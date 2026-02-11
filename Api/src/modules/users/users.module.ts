import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '@entities/users.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { ExcelService } from '@modules/import/excel.service';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserApprover]), NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, ExcelService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
