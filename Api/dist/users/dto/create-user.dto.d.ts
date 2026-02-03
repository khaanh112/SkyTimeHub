import { UserRole } from "../../common/enums/roles.enum";
import { UserStatus } from "../../common/enums/user-status.enum";
export declare class CreateUserDto {
    employeeId?: string;
    email?: string;
    username?: string;
    role?: UserRole;
    status?: UserStatus;
    departmentId?: number;
    position?: string;
    phone?: string;
    joinDate?: Date;
}
