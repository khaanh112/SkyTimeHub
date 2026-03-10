import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user.dto';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
