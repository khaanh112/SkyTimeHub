import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { OtTimeType } from '@/common/enums/ot-time-type.enum';
import { User } from './users.entity';
import { OtPlan } from './ot-plan.entity';
import { OtCheckin } from './ot-checkin.entity';

@Entity('ot_plan_employees')
@Index('idx_ot_pe_plan', ['otPlanId'])
@Index('idx_ot_pe_employee_time', ['employeeId', 'startTime', 'endTime'])
@Check('chk_ot_pe_time_range', '"end_time" > "start_time"')
export class OtPlanEmployee {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ── Parent plan ────────────────────────────────────────────
  @ApiProperty({ example: 1, description: 'Parent OT plan ID' })
  @Column({ name: 'ot_plan_id', type: 'int', nullable: false })
  otPlanId: number;

  @Exclude()
  @ManyToOne(() => OtPlan, (plan) => plan.employees, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ot_plan_id' })
  otPlan: OtPlan;

  // ── Employee ───────────────────────────────────────────────
  @ApiProperty({ example: 5, description: 'Assigned employee user ID' })
  @Column({ name: 'employee_id', type: 'int', nullable: false })
  employeeId: number;

  @Exclude()
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  // ── Time range ─────────────────────────────────────────────
  @ApiProperty({ example: '2026-03-15T08:00:00Z', description: 'Planned OT start' })
  @Column({ name: 'start_time', type: 'timestamptz', nullable: false })
  startTime: Date;

  @ApiProperty({ example: '2026-03-15T12:00:00Z', description: 'Planned OT end' })
  @Column({ name: 'end_time', type: 'timestamptz', nullable: false })
  endTime: Date;

  @ApiProperty({ example: 240, description: 'Duration in minutes (computed from start/end)' })
  @Column({ name: 'duration_minutes', type: 'int', nullable: false })
  durationMinutes: number;

  // ── Task ───────────────────────────────────────────────────
  @ApiProperty({ example: 'Deploy hotfix to production', description: 'Planned task' })
  @Column({ name: 'planned_task', type: 'varchar', length: 150, nullable: false })
  plannedTask: string;

  // ── OT classification ─────────────────────────────────────
  @ApiProperty({ enum: OtDayType, example: OtDayType.WEEKDAY, description: 'Day type' })
  @Column({ name: 'day_type', type: 'enum', enum: OtDayType, nullable: false })
  dayType: OtDayType;

  @ApiProperty({ enum: OtTimeType, example: OtTimeType.DAY, description: 'OT time type' })
  @Column({ name: 'ot_time_type', type: 'enum', enum: OtTimeType, nullable: false })
  otTimeType: OtTimeType;

  // ── Relations ──────────────────────────────────────────────
  @Exclude()
  @OneToMany(() => OtCheckin, (c) => c.otPlanEmployee, { cascade: true })
  checkins: OtCheckin[];

  // ── Timestamps ─────────────────────────────────────────────
  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
