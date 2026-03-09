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
import { OtPlanStatus } from '@/common/enums/ot-plan-status.enum';
import { User } from './users.entity';
import { Department } from './departments.entity';
import { OtPlanEmployee } from './ot-plan-employee.entity';

@Entity('ot_plans')
@Index('idx_ot_plans_dept_status', ['departmentId', 'status'])
@Index('idx_ot_plans_created_by', ['createdBy'])
@Index('idx_ot_plans_approver_status', ['approverId', 'status'])
export class OtPlan {
  @ApiProperty({ example: 1, description: 'OT plan ID' })
  @PrimaryGeneratedColumn()
  id: number;

  // ── Plan info ──────────────────────────────────────────────
  @ApiProperty({ example: 'March OT Plan', description: 'Plan title' })
  @Column({ type: 'varchar', length: 100, nullable: false })
  title: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ── Department ─────────────────────────────────────────────
  @ApiProperty({ example: 1, description: 'Department ID' })
  @Column({ name: 'department_id', type: 'int', nullable: false })
  departmentId: number;

  @Exclude()
  @ManyToOne(() => Department, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  // ── Creator (Department Leader) ────────────────────────────
  @ApiProperty({ example: 1, description: 'Creator user ID (department leader)' })
  @Column({ name: 'created_by', type: 'int', nullable: false })
  createdBy: number;

  @Exclude()
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  // ── Approver (BOD) ─────────────────────────────────────────
  @ApiProperty({ example: 2, description: 'BOD approver user ID' })
  @Column({ name: 'approver_id', type: 'int', nullable: false })
  approverId: number;

  @Exclude()
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  // ── Duration (computed sum) ────────────────────────────────
  @ApiProperty({ example: 480, description: 'Total duration in minutes (sum of all employee rows)' })
  @Column({ name: 'total_duration_minutes', type: 'int', nullable: false, default: 0 })
  totalDurationMinutes: number;

  // ── Status workflow ────────────────────────────────────────
  @ApiProperty({
    enum: OtPlanStatus,
    example: OtPlanStatus.PENDING,
    description: 'Plan status',
  })
  @Column({
    type: 'enum',
    enum: OtPlanStatus,
    default: OtPlanStatus.PENDING,
  })
  status: OtPlanStatus;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason: string | null;

  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @VersionColumn({ default: 1 })
  version: number;

  @ApiPropertyOptional({ description: 'Approval timestamp' })
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ description: 'Rejection timestamp' })
  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @ApiPropertyOptional({ description: 'Cancellation timestamp' })
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  // ── Relations ──────────────────────────────────────────────
  @Exclude()
  @OneToMany(() => OtPlanEmployee, (e) => e.otPlan, { cascade: true })
  employees: OtPlanEmployee[];

  // ── Timestamps ─────────────────────────────────────────────
  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
