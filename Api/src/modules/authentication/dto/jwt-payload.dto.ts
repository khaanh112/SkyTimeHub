import { UserRole } from '@common/enums/roles.enum';

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
  /** Token issued at timestamp (added by JWT) */
  iat?: number;
  /** Token expiration timestamp (added by JWT) */
  exp?: number;
}
