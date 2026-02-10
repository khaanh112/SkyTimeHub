import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsService } from './notifications.service';
import { EmailWorkerService } from './email-worker.service';
import { EmailQueue } from '@entities/email_queue.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailQueue]),
  ],
  controllers: [],
  providers: [NotificationsService, EmailWorkerService],
  exports: [NotificationsService], // Export to use in other modules
})
export class NotificationsModule {}
