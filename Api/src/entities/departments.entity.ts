import { DepartmentEnum } from "@/common/enums/departments.enum";
import {
  Column,
  Entity,
  OneToMany,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Exclude } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { User } from "./users.entity";

@Entity("departments")
export class Department {
  @ApiProperty({ example: 1, description: 'Department ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ enum: DepartmentEnum, description: 'Department name' })
  @Column({ type: "enum", enum: DepartmentEnum, unique: true })
  name: DepartmentEnum;

  @ApiPropertyOptional({ example: 1, description: 'Department leader user ID' })
  @Column({ name: "leader_id", nullable: true })
  leaderId: number | null;

  // leader của phòng ban (nullable)
  @Exclude()
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "leader_id" })
  leader: User | null;

  // danh sách user thuộc phòng ban
  @Exclude()
  @OneToMany(() => User, (user) => user.department)
  users: User[];
}
