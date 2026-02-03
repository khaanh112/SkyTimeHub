import { UserRole } from '../../common/enums/roles.enum';


export interface JwtPayload {
  sub: number; // user id
  email: string;
  username: string;
  role: UserRole;
}
