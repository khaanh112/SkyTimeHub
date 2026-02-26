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
import { LeaveSession } from '@/common/enums/leave-session.enum';
import { User } from '@/entities/users.entity';
import { LeaveRequestNotificationRecipient } from './leave-request-notification-recipient.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveRequestItem } from './leave-request-item.entity';
import { LeaveRequestAttachment } from './leave-request-attachment.entity';
import { CompWorkRequest } from './comp-work-request.entity';

@Entity('leave_requests')
@Index('idx_leave_requests_user_status', ['userId', 'status'])
@Index('idx_leave_requests_approver_status', ['approverId', 'status'])
export class LeaveRequest {
  @ApiProperty({ example: 1, description: 'Leave request ID' })
  @PrimaryGeneratedColumn()
  id: number;

  // ── Requester ──────────────────────────────────────────────
  @ApiProperty({ example: 1, description: 'Requester user ID' })
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Exclude()
  @ManyToOne(() => User, (user) => user.leaveRequests, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ── Approver (snapshot tại thời điểm tạo) ─────────────────
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

  // ── Leave Type (FK → leave_types) ─────────────────────────
  @ApiPropertyOptional({ example: 1, description: 'Requested leave type ID' })
  @Column({ name: 'requested_leave_type_id', type: 'bigint', nullable: true })
  requestedLeaveTypeId: number | null;

  @Exclude()
  @ManyToOne(() => LeaveType, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_leave_type_id' })
  requestedLeaveType: LeaveType | null;

  // ── Date & Session ────────────────────────────────────────
  @ApiProperty({ example: '2026-02-10', description: 'Leave start date (YYYY-MM-DD)' })
  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @ApiProperty({ example: '2026-02-12', description: 'Leave end date (YYYY-MM-DD)' })
  @Column({ type: 'date', name: 'end_date' })
  endDate: string;

  @ApiProperty({ enum: LeaveSession, example: LeaveSession.AM, description: 'Start session (AM/PM)' })
  @Column({ name: 'start_session', type: 'enum', enum: LeaveSession })
  startSession: LeaveSession;

  @ApiProperty({ enum: LeaveSession, example: LeaveSession.PM, description: 'End session (AM/PM)' })
  @Column({ name: 'end_session', type: 'enum', enum: LeaveSession })
  endSession: LeaveSession;

  // ── Duration ──────────────────────────────────────────────
  @ApiPropertyOptional({ example: 2.5, description: 'Duration in half-day steps' })
  @Column({ name: 'duration', type: 'numeric', precision: 5, scale: 2, nullable: true })
  duration: number | null;

  @ApiPropertyOptional({ example: 2.5, description: 'Duration in days (0.5 step)' })
  @Column({ name: 'duration_days', type: 'numeric', precision: 5, scale: 2, nullable: true })
  durationDays: number | null;

  // ── Slot range (trigger-computed, for overlap exclusion) ──
  @Column({ name: 'start_slot', type: 'int' })
  startSlot: number;

  @Column({ name: 'end_slot', type: 'int' })
  endSlot: number;

  // ── Compensatory balance usage ────────────────────────────
  @ApiPropertyOptional({ example: false, description: 'Use compensatory balance for this request' })
  @Column({ name: 'use_comp_balance', type: 'boolean', default: false })
  useCompBalance: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Compensatory minutes used (30-min steps)' })
  @Column({ name: 'comp_used_minutes', type: 'int', default: 0 })
  compUsedMinutes: number;

  // ── Content ───────────────────────────────────────────────
  @ApiProperty({ example: 'Family vacation', description: 'Reason for leave' })
  @Column({ type: 'text', nullable: false })
  reason: string;

  @ApiPropertyOptional({
    example: 'Handover to John, OT compensation',
    description: 'Work solution/handover plan',
  })
  @Column({ name: 'work_solution', type: 'text', nullable: true })
  workSolution?: string;

  // ── Status workflow ───────────────────────────────────────
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

  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @VersionColumn({ default: 1 })
  version: number;

  @ApiPropertyOptional({ description: 'Approval timestamp' })
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @ApiPropertyOptional({ description: 'Rejection timestamp' })
  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt?: Date;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason?: string;

  @ApiPropertyOptional({ description: 'Cancellation timestamp' })
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  // ── Relations ─────────────────────────────────────────────

  /** Notification recipients (HR default + user-selected CC) */
  @Exclude()
  @OneToMany(() => LeaveRequestNotificationRecipient, (r) => r.request, { cascade: true })
  notificationRecipients: LeaveRequestNotificationRecipient[];

  /** Split items when conversion kicks in (Paid→Unpaid etc.) */
  @Exclude()
  @OneToMany(() => LeaveRequestItem, (item) => item.leaveRequest, { cascade: true })
  items: LeaveRequestItem[];

  /** Attachments (social benefits documents) */
  @Exclude()
  @OneToMany(() => LeaveRequestAttachment, (att) => att.leaveRequest, { cascade: true })
  attachments: LeaveRequestAttachment[];

  /** Compensatory working plans linked to this leave */
  @Exclude()
  @OneToMany(() => CompWorkRequest, (cw) => cw.leaveRequest)
  compWorkRequests: CompWorkRequest[];

  // ── Timestamps ────────────────────────────────────────────
  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
