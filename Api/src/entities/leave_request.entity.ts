// src/entities/leave-request.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@/common/enums/request_status';
import { User } from '@/entities/users.entity';
import { LeaveRequestNotificationRecipient } from './leave-request-notification-recipient.entity';

@Entity('leave_requests')
@Index('idx_leave_requests_user_status', ['userId', 'status'])
@Index('idx_leave_requests_approver_status', ['approverId', 'status'])
export class LeaveRequest {
  @ApiProperty({ example: 1, description: 'Leave request ID' })
  @PrimaryGeneratedColumn()
  id: number;

  // requester
  @ApiProperty({ example: 1, description: 'Requester user ID' })
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Exclude()
  @ManyToOne(() => User, (user) => user.leaveRequests, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // current approver (tại thời điểm tạo request / snapshot)
  @ApiProperty({ example: 2, description: 'Approver user ID' })
  @Column({ name: 'approver_id', type: 'int' })
  approverId: number;

  @Exclude()
  @ManyToOne(() => User, (user) => user.approvalsToReview, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @ApiProperty({ example: '2026-02-10', description: 'Leave start date (YYYY-MM-DD)' })
  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @ApiProperty({ example: '2026-02-12', description: 'Leave end date (YYYY-MM-DD)' })
  @Column({ type: 'date', name: 'end_date' })
  endDate: string;

  @ApiProperty({ example: 'Family vacation', description: 'Reason for leave' })
  @Column({ type: 'text', nullable: false })
  reason: string;

  @ApiProperty({ example: 'Handover to John, OT compensation', description: 'Work solution/handover plan for leave'})
  @Column({ name: 'work_solution', type: 'text', nullable: true })
  workSolution?: string;

  @ApiProperty({
    enum: LeaveRequestStatus,
    example: LeaveRequestStatus.PENDING,
    description: 'Request status',
  })
  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  status: LeaveRequestStatus;

  @ApiProperty({ example: 1, description: 'Version number for optimistic locking' })
  @VersionColumn({ default: 1 })
  version: number;

  @ApiPropertyOptional({ example: '2026-02-10T10:00:00.000Z', description: 'Approval timestamp' })
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @ApiPropertyOptional({ example: '2026-02-10T10:00:00.000Z', description: 'Rejection timestamp' })
  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt?: Date;

  @ApiPropertyOptional({ example: 'Reason for rejection', description: 'Reason for rejection' })
  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason?: string;

  @ApiPropertyOptional({
    example: '2026-02-10T10:00:00.000Z',
    description: 'Cancellation timestamp',
  })
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  // danh sách người nhận notify (HR default + user chọn thêm)
  @Exclude()
  @OneToMany(() => LeaveRequestNotificationRecipient, (r) => r.request, { cascade: true })
  notificationRecipients: LeaveRequestNotificationRecipient[];

  @ApiProperty({ example: '2026-02-10T09:00:00.000Z', description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-10T10:00:00.000Z', description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
