import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequest } from './leave_request.entity';
import { LeaveType } from './leave-type.entity';

@Entity('leave_request_items')
@Unique('uq_lri_request_type_period', [
  'leaveRequestId',
  'leaveTypeId',
  'periodYear',
  'periodMonth',
])
@Index('idx_lri_request_id', ['leaveRequestId'])
@Index('idx_lri_period', ['periodYear', 'periodMonth'])
export class LeaveRequestItem {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'leave_request_id', type: 'int' })
  leaveRequestId: number;

  @ManyToOne(() => LeaveRequest, (lr) => lr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_request_id' })
  leaveRequest: LeaveRequest;

  @Column({ name: 'leave_type_id', type: 'bigint' })
  leaveTypeId: number;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @ApiProperty({ example: 2.5, description: 'Amount in days (0.5 step)' })
  @Column({ name: 'amount_days', type: 'numeric', precision: 5, scale: 2 })
  amountDays: number;

  @ApiProperty({ example: 2026, description: 'Period year' })
  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

  @ApiProperty({ example: 3, description: 'Period month (1-12)' })
  @Column({ name: 'period_month', type: 'int' })
  periodMonth: number;

  @ApiPropertyOptional({ description: 'Note (e.g. "converted from Policy excess")' })
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
