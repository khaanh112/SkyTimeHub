import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

// Modules
import { UsersModule } from '../users/users.module';

// Controllers
import { AuthController } from './controllers/auth.controller';

// Services
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { ZohoAuthService } from './services/zoho-auth.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { ZohoStrategy } from './strategies/zoho.strategy';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Entities
import { RefreshToken } from './entities/refresh-token.entity';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.get<number>('JWT_EXPIRATION')}s`,
        },
      }),
    }),
    TypeOrmModule.forFeature([RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [
    // Services
    AuthService,
    TokenService,
    RefreshTokenService,
    ZohoAuthService,
    // Strategies
    JwtStrategy,
    ZohoStrategy,
    // Global Guard - Authentication
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, TokenService, JwtModule],
})
export class AuthenticationModule {}
