import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const getJwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET') || 'default-secret',
  signOptions: {
    expiresIn: Number(configService.get<string>('JWT_EXPIRATION')) || 3600,
  },
});
