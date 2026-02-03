import { UserRole } from '../../common/enums/roles.enum';
export interface JwtPayload {
    sub: number;
    email: string;
    username: string;
    role: UserRole;
}
