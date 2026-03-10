import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

const getRequiredNumber = (configService: ConfigService, key: string): number => {
  const value = Number(configService.getOrThrow<string>(key));

  if (Number.isNaN(value)) {
    throw new Error(`Invalid ${key} configuration`);
  }

  return value;
};

export const getJwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.getOrThrow<string>('JWT_SECRET'),
  signOptions: {
    expiresIn: getRequiredNumber(configService, 'JWT_EXPIRATION'),
  },
});
