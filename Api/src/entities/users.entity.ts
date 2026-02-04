import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { UserRole } from "../common/enums/roles.enum";
import { UserStatus } from "src/common/enums/user-status.enum";
import { Department } from "./departments.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "employee_id", unique: true, nullable: true })
  employeeId: string;

  @Column()
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.INACTIVE })
  status: UserStatus;

  @Column({ name: "department_id", nullable: true })
  departmentId: number | null;

  @ManyToOne(() => Department, (department) => department.users, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "department_id" })
  department: Department | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  position: string;

  @Column({ name: "join_date", type: "date", nullable: true })
  joinDate: Date;

  @Column({ name: "activation_token", nullable: true })
  activationToken: string;

  @Column({ name: "activated_at", type: "timestamp", nullable: true })
  activatedAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
