import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveType } from './leave-type.entity';

@Entity('leave_categories')
export class LeaveCategory {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiProperty({ example: 'ANNUAL', description: 'Unique category code' })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @ApiProperty({ example: 'Annual Leave', description: 'Display name' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => LeaveType, (lt) => lt.category)
  leaveTypes: LeaveType[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
