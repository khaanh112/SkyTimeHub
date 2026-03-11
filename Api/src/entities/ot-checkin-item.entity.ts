import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { OtCheckin } from './ot-checkin.entity';
import { OtType } from './ot-type.entity';

@Entity('ot_checkin_items')
@Index('idx_ot_ci_checkin', ['otCheckinId'])
@Index('idx_ot_ci_emp_attributed', ['employeeId', 'attributedDate'])
export class OtCheckinItem {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ── Parent ─────────────────────────────────────────────────
  @ApiProperty({ example: 1, description: 'Parent OtCheckin ID' })
  @Column({ name: 'ot_checkin_id', type: 'bigint', nullable: false })
  otCheckinId: number;

  @Exclude()
  @ManyToOne(() => OtCheckin, (c) => c.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ot_checkin_id' })
  otCheckin: OtCheckin;

  // ── Employee (denormalized) ────────────────────────────────
  @ApiProperty({ example: 5, description: 'Employee user ID' })
  @Column({ name: 'employee_id', type: 'int', nullable: false })
  employeeId: number;

  // ── OT Type ────────────────────────────────────────────────
  @ApiProperty({ example: 1 })
  @Column({ name: 'ot_type_id', type: 'bigint', nullable: false })
  otTypeId: number;

  @Exclude()
  @ManyToOne(() => OtType, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ot_type_id' })
  otType: OtType;

  @ApiProperty({ enum: OtDayType, example: OtDayType.WEEKDAY })
  @Column({ name: 'day_type', type: 'enum', enum: OtDayType, nullable: false })
  dayType: OtDayType;

  // ── Physical time ──────────────────────────────────────────
  @ApiProperty({ example: '2026-03-15T18:00:00Z' })
  @Column({ name: 'start_time', type: 'timestamptz', nullable: false })
  startTime: Date;

  @ApiProperty({ example: '2026-03-15T22:00:00Z' })
  @Column({ name: 'end_time', type: 'timestamptz', nullable: false })
  endTime: Date;

  @ApiProperty({ example: 240, description: 'Minutes attributed to attributedDate' })
  @Column({ name: 'duration_minutes', type: 'int', nullable: false })
  durationMinutes: number;

  // ── Attribution ────────────────────────────────────────────
  @ApiProperty({ example: '2026-03-15', description: 'Actual calendar date of segment (HR reference)' })
  @Column({ name: 'actual_date', type: 'date', nullable: false })
  actualDate: string;

  @ApiProperty({ example: '2026-03-15', description: 'Accounting date credited to (may differ from actualDate after carry-over)' })
  @Column({ name: 'attributed_date', type: 'date', nullable: false })
  attributedDate: string;

  // ── Timestamps ─────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
