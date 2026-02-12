import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../common/enums/roles.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { Department } from './departments.entity';
import { LeaveRequest } from './leave_request.entity';
import { UserGender } from '@/common/enums/user-genders';

@Entity('users')
export class User {
  @ApiProperty({ example: 1, description: 'User ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'EMP26001', description: 'Employee ID' })
  @Column({ name: 'employee_id', unique: true, nullable: true })
  employeeId: string;

  @ApiPropertyOptional({ example: 'johndoe', description: 'Username' })
  @Column({ nullable: true })
  username: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email address' })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ example: 'male', description: 'Gender' })
  @Column({ type: 'enum', enum: UserGender, nullable: false })
  gender: UserGender;

  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE, description: 'User role' })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE, description: 'Account status' })
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.INACTIVE })
  status: UserStatus;

  @ApiPropertyOptional({ example: 1, description: 'Department ID' })
  @Column({ name: 'department_id', nullable: true })
  departmentId: number | null;

  @Exclude()
  @OneToMany(() => LeaveRequest, (leaveRequest) => leaveRequest.user)
  leaveRequests: LeaveRequest[];

  @Exclude()
  @OneToMany(() => LeaveRequest, (leaveRequest) => leaveRequest.approver)
  approvalsToReview: LeaveRequest[];

  @Exclude()
  @ManyToOne(() => Department, (department) => department.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @ApiPropertyOptional({ example: 'Software Engineer', description: 'Job position' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Join date' })
  @Column({ name: 'join_date', type: 'date', nullable: true })
  joinDate: Date;

  @Exclude()
  @Column({ name: 'activation_token', nullable: true })
  activationToken: string;

  @ApiPropertyOptional({ description: 'Account activation timestamp' })
  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
