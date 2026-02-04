import { AuthGuard } from '@nestjs/passport';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ZohoOAuthGuard extends AuthGuard('zoho') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // If there's an OAuth error (e.g., access_denied), skip guard validation
    // The controller will handle the error redirect
    if (request.query.error) {
      return true;
    }
    
    return super.canActivate(context);
  }
}
