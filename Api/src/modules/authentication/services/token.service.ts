import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@entities/users.entity';
import { JwtPayload } from '../dto/jwt-payload.dto';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private getRequiredSecret(key: string): string {
    return this.configService.getOrThrow<string>(key);
  }

  private getRequiredExpirationSeconds(key: string): number {
    const value = Number(this.configService.getOrThrow<string>(key));

    if (Number.isNaN(value)) {
      throw new Error(`Invalid ${key} configuration`);
    }

    return value;
  }

  async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      gender: user.gender,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    return { accessToken, refreshToken };
  }

  async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.getRequiredSecret('JWT_SECRET'),
      expiresIn: this.getRequiredExpirationSeconds('JWT_EXPIRATION'),
    });
  }

  async generateRefreshToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.getRequiredSecret('JWT_REFRESH_SECRET'),
      expiresIn: this.getRequiredExpirationSeconds('JWT_REFRESH_EXPIRATION'),
    });
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.getRequiredSecret('JWT_REFRESH_SECRET'),
    });
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.getRequiredSecret('JWT_SECRET'),
    });
  }

  getRefreshTokenExpiration(): Date {
    const expiresAt = new Date();
    const expirationSeconds = this.getRequiredExpirationSeconds('JWT_REFRESH_EXPIRATION');
    expiresAt.setSeconds(expiresAt.getSeconds() + expirationSeconds);
    return expiresAt;
  }
}
