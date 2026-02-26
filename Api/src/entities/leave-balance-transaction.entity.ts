import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from './users.entity';
import { LeaveType } from './leave-type.entity';

@Entity('leave_balance_transactions')
export class LeaveBalanceTransaction {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ name: 'leave_type_id', type: 'bigint' })
  leaveTypeId: number;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @ApiProperty({ example: 2026, description: 'Period year' })
  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

  @ApiPropertyOptional({ example: 3, description: 'Period month (null for annual adjustments)' })
  @Column({ name: 'period_month', type: 'int', nullable: true })
  periodMonth: number | null;

  @ApiProperty({ example: 'CREDIT', description: 'CREDIT or DEBIT' })
  @Column({ type: 'varchar', length: 10 })
  direction: string;

  @ApiProperty({ example: 1.0, description: 'Amount in days (0.5 step)' })
  @Column({ name: 'amount_days', type: 'numeric', precision: 7, scale: 2 })
  amountDays: number;

  @ApiProperty({ example: 'ACCRUAL', description: 'Source type' })
  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType: string;

  @ApiPropertyOptional({ description: 'Source record ID (leave_request.id, etc.)' })
  @Column({ name: 'source_id', type: 'bigint', nullable: true })
  sourceId: number | null;

  @ApiPropertyOptional({ description: 'Freetext note' })
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
