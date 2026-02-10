// src/entities/leave-request-notification-recipient.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  JoinColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { LeaveRequest } from './leave_request.entity';
import { User } from './users.entity';
import { RecipientType } from '@common/enums/recipient-type.enum';

@Entity('leave_request_notification_recipients')
@Unique('uq_leave_notify_request_user', ['requestId', 'userId'])
@Index('idx_leave_notify_request', ['requestId'])
@Index('idx_leave_notify_user_type', ['userId', 'type'])
export class LeaveRequestNotificationRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_id', type: 'int' })
  requestId: number;

  @Exclude()
  @ManyToOne(() => LeaveRequest, (leaveRequest) => leaveRequest.notificationRecipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: LeaveRequest;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Exclude()
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: RecipientType, default: RecipientType.CC })
  type: RecipientType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
