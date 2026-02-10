// src/entities/user-approver.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from './users.entity';

@Entity('user_approvers')
@Unique('uq_user_approver_active', ['userId', 'active']) // optional logic: chỉ 1 active mapping
@Index('idx_user_approvers_user_active', ['userId', 'active'])
export class UserApprover {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Exclude()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'approver_id', type: 'int' })
  approverId: number;

  @Exclude()
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // audit ai set rule
  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
