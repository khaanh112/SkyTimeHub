import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtCheckinStatus } from '@/common/enums/ot-checkin-status.enum';
import { OtCompensatoryMethod } from '@/common/enums/ot-compensatory-method.enum';
import { User } from './users.entity';
import { OtPlanEmployee } from './ot-plan-employee.entity';
import { OtCheckinItem } from './ot-checkin-item.entity';

@Entity('ot_checkins')
@Index('idx_ot_checkins_plan_emp', ['otPlanEmployeeId'])
@Index('idx_ot_checkins_status', ['status'])
export class OtCheckin {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ── Parent assignment ──────────────────────────────────────
  @ApiProperty({ example: 1, description: 'OT plan employee assignment ID' })
  @Column({ name: 'ot_plan_employee_id', type: 'bigint', nullable: false })
  otPlanEmployeeId: number;

  @Exclude()
  @ManyToOne(() => OtPlanEmployee, (pe) => pe.checkins, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ot_plan_employee_id' })
  otPlanEmployee: OtPlanEmployee;

  // ── Check-in / Check-out ───────────────────────────────────
  @ApiPropertyOptional({ description: 'Actual check-in timestamp' })
  @Column({ name: 'check_in_at', type: 'timestamptz', nullable: true })
  checkInAt: Date | null;

  @ApiPropertyOptional({ description: 'Actual check-out timestamp' })
  @Column({ name: 'check_out_at', type: 'timestamptz', nullable: true })
  checkOutAt: Date | null;

  @ApiPropertyOptional({ example: 230, description: 'Actual duration in minutes' })
  @Column({ name: 'actual_duration_minutes', type: 'int', nullable: true })
  actualDurationMinutes: number | null;

  // ── Employee output ────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Work output description from employee' })
  @Column({ name: 'work_output', type: 'text', nullable: true })
  workOutput: string | null;

  @ApiPropertyOptional({
    enum: OtCompensatoryMethod,
    description: 'Compensation method chosen by employee',
  })
  @Column({
    name: 'compensatory_method',
    type: 'enum',
    enum: OtCompensatoryMethod,
    nullable: true,
  })
  compensatoryMethod: OtCompensatoryMethod | null;

  // ── Status workflow ────────────────────────────────────────
  @ApiProperty({
    enum: OtCheckinStatus,
    example: OtCheckinStatus.PENDING,
    description: 'Check-in lifecycle status',
  })
  @Column({
    type: 'enum',
    enum: OtCheckinStatus,
    default: OtCheckinStatus.PENDING,
  })
  status: OtCheckinStatus;

  // ── Leader approval ────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Leader approval timestamp' })
  @Column({ name: 'leader_approved_at', type: 'timestamptz', nullable: true })
  leaderApprovedAt: Date | null;

  @ApiPropertyOptional({ example: 1, description: 'Leader who approved actual hours' })
  @Column({ name: 'leader_approved_by', type: 'int', nullable: true })
  leaderApprovedBy: number | null;

  @Exclude()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'leader_approved_by' })
  approvedByLeader: User | null;

  @ApiPropertyOptional({ description: 'Rejection reason from leader' })
  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason: string | null;

  // ── Optimistic lock ────────────────────────────────────────
  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @VersionColumn({ default: 1 })
  version: number;

  // ── Timestamps ─────────────────────────────────────────────
  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Items ──────────────────────────────────────────────────
  @OneToMany(() => OtCheckinItem, (item) => item.otCheckin, { cascade: true })
  items: OtCheckinItem[];
}
