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
import { OtBalanceSource } from '@/common/enums/ot-balance-source.enum';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { User } from './users.entity';
import { OtType } from './ot-type.entity';
import { OtBalanceDirection } from '@/common/enums/ot-balance-direction.enum';

@Entity('ot_balance_transactions')
@Index('idx_ot_bal_emp_year_month', ['employeeId', 'periodYear', 'periodMonth'])
@Index('idx_ot_bal_emp_date', ['employeeId', 'periodDate'])
@Index('idx_ot_bal_source', ['sourceType', 'sourceId'])
export class OtBalanceTransaction {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ── Employee ───────────────────────────────────────────────
  @ApiProperty({ example: 5, description: 'Employee user ID' })
  @Column({ name: 'employee_id', type: 'int', nullable: false })
  employeeId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  // ── Direction ──────────────────────────────────────────────
  @ApiProperty({ example: OtBalanceDirection.CREDIT, description: 'CREDIT = hours used, DEBIT = hours refunded' })
  @Column({ type: 'varchar', length: 10, nullable: false })
  direction: OtBalanceDirection;

  // ── Amount ─────────────────────────────────────────────────
  @ApiProperty({ example: 240, description: 'Amount in minutes (always positive)' })
  @Column({ name: 'amount_minutes', type: 'int', nullable: false })
  amountMinutes: number;

  // ── Source ─────────────────────────────────────────────────
  @ApiProperty({ enum: OtBalanceSource, example: OtBalanceSource.OT_PLAN_CREATED })
  @Column({ name: 'source_type', type: 'enum', enum: OtBalanceSource, nullable: false })
  sourceType: OtBalanceSource;

  @ApiPropertyOptional({ description: 'Source record ID (ot_plan_employees.id or ot_checkins.id)' })
  @Column({ name: 'source_id', type: 'bigint', nullable: true })
  sourceId: number | null;

  // ── Period ─────────────────────────────────────────────────
  @ApiProperty({ example: 2026, description: 'Period year (for yearly limit check)' })
  @Column({ name: 'period_year', type: 'int', nullable: false })
  periodYear: number;

  @ApiProperty({ example: 3, description: 'Period month 1-12 (for monthly limit check)' })
  @Column({ name: 'period_month', type: 'int', nullable: false })
  periodMonth: number;

  @ApiPropertyOptional({
    example: '2026-03-15',
    description: 'Period date (for daily limit check)',
  })
  @Column({ name: 'period_date', type: 'date', nullable: true })
  periodDate: string | null;

  // ── OT type (set on per-item transactions) ───────────────
  @ApiPropertyOptional({ enum: OtDayType, description: 'Day type of the segment (null for legacy bulk transactions)' })
  @Column({ name: 'day_type', type: 'enum', enum: OtDayType, nullable: true })
  dayType: OtDayType | null;

  @ApiPropertyOptional({ example: 1, description: 'ot_types.id FK (nullable)' })
  @Column({ name: 'ot_type_id', type: 'bigint', nullable: true })
  otTypeId: number | null;

  @ManyToOne(() => OtType, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ot_type_id' })
  otType: OtType | null;

  @ApiPropertyOptional({ example: '2026-03-15', description: 'Actual calendar date of the segment (HR reference)' })
  @Column({ name: 'actual_date', type: 'date', nullable: true })
  actualDate: string | null;

  // ── Note ───────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Freetext note' })
  @Column({ type: 'text', nullable: true })
  note: string | null;

  // ── Timestamps ─────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
