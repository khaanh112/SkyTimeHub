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
import { ContractType } from '@/common/enums/contract-type.enum';

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
  @ManyToOne(() => Department, (department) => department.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @ApiPropertyOptional({ example: 'Software Engineer', description: 'Job position' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string;

  @ApiPropertyOptional({ example: '0901234567', description: 'Phone number' })
  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @ApiPropertyOptional({ example: '1995-06-15', description: 'Date of birth' })
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @ApiPropertyOptional({ example: '123 Main St, Hanoi', description: 'Address' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @ApiPropertyOptional({ enum: ContractType, example: ContractType.OFFICIAL, description: 'Contract type' })
  @Column({ name: 'contract_type', type: 'enum', enum: ContractType, nullable: true })
  contractType: ContractType;

  @Exclude()
  @OneToMany(() => LeaveRequest, (leaveRequest) => leaveRequest.user)
  leaveRequests: LeaveRequest[];

  @Exclude()
  @OneToMany(() => LeaveRequest, (leaveRequest) => leaveRequest.approver)
  approvalsToReview: LeaveRequest[];

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Join date' })
  @Column({ name: 'join_date', type: 'date', nullable: true })
  joinDate: Date;

  @ApiPropertyOptional({ example: '2022-01-01', description: 'Official contract date' })
  @Column({ name: 'official_contract_date', type: 'date', nullable: true })
  officialContractDate: Date;

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
