import { UserRole } from '@common/enums/roles.enum';
import { UserGender } from '@common/enums/user-genders';

/**
 * Authenticated user data available in request after JWT verification
 * This represents the user data set by JwtAuthGuard and accessed via @CurrentUser() decorator
 */
export interface AuthenticatedUser {
  /** User ID */
  id: number;
  /** User email address */
  email: string;
  /** Username */
  username: string;
  /** User role */
  role: UserRole;
  /** User gender */
  gender?: UserGender;
}
