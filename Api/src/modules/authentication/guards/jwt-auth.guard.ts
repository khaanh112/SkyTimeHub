import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;
    const method = request.method;

    this.logger.log(`[${method}] ${url} - JWT Guard called`);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.log(`[${method}] ${url} - Public endpoint, skipping auth`);
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn(`[${method}] ${url} - No token provided`);
      throw new UnauthorizedException('No token provided');
    }

    this.logger.log(`[${method}] ${url} - Token found, verifying...`);

    try {
      const payload = await this.jwtService.verifyAsync(token);
      this.logger.log(
        `[${method}] ${url} - Token verified for user: ${payload.sub} (${payload.email})`,
      );

      // Set full user payload to request for use in guards/controllers
      request.user = {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
        role: payload.role,
      };

      this.logger.log(`[${method}] ${url} - User set on request: ${JSON.stringify(request.user)}`);
    } catch (error) {
      this.logger.error(`[${method}] ${url} - Token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
