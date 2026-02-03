import { UserRole } from "../common/enums/roles.enum";
import { UserStatus } from "src/common/enums/user-status.enum";
import { Department } from "../departments/departments.entity";
export declare class User {
    id: number;
    employeeId: string;
    username: string;
    email: string;
    refreshTokenHash: string;
    role: UserRole;
    status: UserStatus;
    departmentId: number;
    department: Department;
    position: string;
    phone: string;
    joinDate: Date;
    activationToken: string;
    activatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
