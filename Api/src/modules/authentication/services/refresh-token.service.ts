import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '@entities/refresh-token.entity';


@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async saveToken(userId: number, token: string, expiresAt: Date): Promise<RefreshToken> {
    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
    });

    return await this.refreshTokenRepository.save(refreshToken);
  }

  async findValidToken(userId: number, token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: {
        userId,
        token,
        isRevoked: false,
      },
    });
  }

  async revokeToken(tokenId: number): Promise<void> {
    await this.refreshTokenRepository.update(tokenId, { isRevoked: true });
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    if (!userId) {
      return; // Silent fail if no userId
    }

    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true }
    );
  }

  isTokenExpired(token: RefreshToken): boolean {
    return new Date() > token.expiresAt;
  }
}
