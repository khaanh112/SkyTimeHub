import { DepartmentEnum } from "@/common/enums/departments.enum";
import {
  Column,
  Entity,
  OneToMany,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./users.entity";

@Entity("departments")
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "enum", enum: DepartmentEnum, unique: true })
  name: DepartmentEnum;

  @Column({ name: "leader_id", nullable: true })
  leaderId: number | null;

  // leader của phòng ban (nullable)
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "leader_id" })
  leader: User | null;

  // danh sách user thuộc phòng ban
  @OneToMany(() => User, (user) => user.department)
  users: User[];
}
