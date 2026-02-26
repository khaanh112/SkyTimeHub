import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from './leave-type.entity';

@Entity('leave_type_policies')
export class LeaveTypePolicy {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'leave_type_id', type: 'bigint' })
  leaveTypeId: number;

  @ManyToOne(() => LeaveType, (lt) => lt.policies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @ApiProperty({ example: '2026-01-01', description: 'Policy effective from' })
  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Policy effective until (null = open)' })
  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @ApiPropertyOptional({ example: 3.0, description: 'Max days per single request' })
  @Column({ name: 'max_per_request_days', type: 'numeric', precision: 5, scale: 2, nullable: true })
  maxPerRequestDays: number | null;

  @ApiPropertyOptional({ example: 0.5, description: 'Minimum leave duration' })
  @Column({ name: 'min_duration_days', type: 'numeric', precision: 5, scale: 2, nullable: true })
  minDurationDays: number | null;

  @ApiPropertyOptional({ example: false, description: 'Allow negative balance (compensatory)' })
  @Column({ name: 'allow_negative', type: 'boolean', default: false })
  allowNegative: boolean;

  @ApiPropertyOptional({ example: 2.0, description: 'Max negative balance limit' })
  @Column({ name: 'max_negative_limit_days', type: 'numeric', precision: 5, scale: 2, nullable: true })
  maxNegativeLimitDays: number | null;

  @ApiPropertyOptional({ example: 30.0, description: 'Annual limit (e.g. unpaid 30 days/year)' })
  @Column({ name: 'annual_limit_days', type: 'numeric', precision: 7, scale: 2, nullable: true })
  annualLimitDays: number | null;

  @ApiPropertyOptional({ example: false, description: 'Auto-calculate end date from start + max days' })
  @Column({ name: 'auto_calculate_end_date', type: 'boolean', default: false })
  autoCalculateEndDate: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
