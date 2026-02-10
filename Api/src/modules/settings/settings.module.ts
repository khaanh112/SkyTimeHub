import { Module } from '@nestjs/common';
import { UserApproverService } from './services/user-approver.service';
import { UserApproverController } from './controller/user-approver.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserApprover } from '@/entities/user_approver.entity';
import { User } from '@/entities/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserApprover, User])],
  providers: [UserApproverService],
  controllers: [UserApproverController],
  exports: [UserApproverService],
})
export class SettingsModule {}
