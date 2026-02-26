import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveType } from './leave-type.entity';

@Entity('leave_type_conversions')
export class LeaveTypeConversion {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'from_leave_type_id', type: 'bigint' })
  fromLeaveTypeId: number;

  @ManyToOne(() => LeaveType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_leave_type_id' })
  fromLeaveType: LeaveType;

  @Column({ name: 'to_leave_type_id', type: 'bigint' })
  toLeaveTypeId: number;

  @ManyToOne(() => LeaveType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_leave_type_id' })
  toLeaveType: LeaveType;

  @ApiProperty({ example: 1, description: 'Conversion priority (lower = first)' })
  @Column({ type: 'int' })
  priority: number;

  @ApiProperty({ example: 'EXCEED_MAX_PER_REQUEST', description: 'Conversion reason' })
  @Column({ type: 'varchar', length: 40 })
  reason: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
