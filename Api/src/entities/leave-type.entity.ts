import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveCategory } from './leave-category.entity';
import { LeaveTypePolicy } from './leave-type-policy.entity';

@Entity('leave_types')
export class LeaveType {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiPropertyOptional({ example: 1, description: 'Category FK' })
  @Column({ name: 'category_id', type: 'bigint', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => LeaveCategory, (cat) => cat.leaveTypes, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: LeaveCategory | null;

  @ApiProperty({ example: 'PAID', description: 'Unique leave type code' })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @ApiProperty({ example: 'Paid Leave', description: 'Display name' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ example: false })
  @Column({ name: 'requires_document', type: 'boolean', default: false })
  requiresDocument: boolean;

  @ApiProperty({ example: false })
  @Column({ name: 'requires_comp_working_date', type: 'boolean', default: false })
  requiresCompWorkingDate: boolean;

  @ApiProperty({ example: false, description: 'System-generated type (e.g. cutoff unpaid)' })
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => LeaveTypePolicy, (p) => p.leaveType)
  policies: LeaveTypePolicy[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
