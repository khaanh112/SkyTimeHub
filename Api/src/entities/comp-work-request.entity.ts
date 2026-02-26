import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompWorkStatus } from '@/common/enums/comp-work-status.enum';
import { User } from './users.entity';
import { LeaveRequest } from './leave_request.entity';

@Entity('comp_work_requests')
export class CompWorkRequest {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ── Employee ──────────────────────────────────────────────
  @Column({ name: 'employee_id', type: 'int' })
  employeeId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  // ── Linked Leave Request (trực tiếp, thay thế leave_comp_links) ──
  @ApiPropertyOptional({ example: 42, description: 'Leave request this comp work belongs to' })
  @Column({ name: 'leave_request_id', type: 'int', nullable: true })
  leaveRequestId: number | null;

  @ManyToOne(() => LeaveRequest, (lr) => lr.compWorkRequests, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'leave_request_id' })
  leaveRequest: LeaveRequest | null;

  // ── Working Schedule ──────────────────────────────────────
  @ApiProperty({ example: '2026-03-01', description: 'Compensatory working date' })
  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @ApiProperty({ example: '08:30:00', description: 'Start time' })
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @ApiProperty({ example: '17:30:00', description: 'End time' })
  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @ApiProperty({ example: 480, description: 'Duration in minutes (30-min steps)' })
  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  // ── Status ────────────────────────────────────────────────
  @ApiProperty({ enum: CompWorkStatus, example: CompWorkStatus.PENDING })
  @Column({ type: 'enum', enum: CompWorkStatus, default: CompWorkStatus.PENDING })
  status: CompWorkStatus;

  @ApiPropertyOptional({ description: 'Approver ID' })
  @Column({ name: 'approver_id', type: 'int', nullable: true })
  approverId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approver_id' })
  approver: User | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
