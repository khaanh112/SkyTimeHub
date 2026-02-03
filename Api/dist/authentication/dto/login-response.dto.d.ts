import { UserRole } from '../../common/enums/roles.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
export declare class LoginResponseDto {
    accessToken: string;
    refreshToken: string;
    user: {
        id: number;
        email: string;
        username: string;
        role: UserRole;
        status: UserStatus;
    };
}
