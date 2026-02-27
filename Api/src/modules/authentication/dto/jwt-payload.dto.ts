import { UserRole } from '@common/enums/roles.enum';
import { UserGender } from '@common/enums/user-genders';

/**
 * JWT payload structure for access tokens
 */
export interface JwtPayload {
  /** User ID */
  sub: number;
  /** User email address */
  email: string;
  /** Username */
  username: string;
  /** User role */
  role: UserRole;
  /** User gender */
  gender?: UserGender;
  /** Token issued at timestamp (added by JWT) */
  iat?: number;
  /** Token expiration timestamp (added by JWT) */
  exp?: number;
}
