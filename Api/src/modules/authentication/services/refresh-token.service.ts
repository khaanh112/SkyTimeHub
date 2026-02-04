import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { RefreshToken } from '@entities/refresh-token.entity';
import { UsersService } from '@modules/users/users.service';
import { User } from '@/entities/users.entity';


@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private dataSource: DataSource,
    private usersService: UsersService,
  
  ) {}

  async saveToken(userId: number, token: string, expiresAt: Date): Promise<RefreshToken> {
    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);

    // Hash and save to user
    const hash = await bcrypt.hash(token, 10);
    await this.usersService.updateRefreshToken(userId, hash);

    return refreshToken;
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

    await this.dataSource.transaction(async (manager) => {

      await manager.update(RefreshToken, { userId, isRevoked: false }, { isRevoked: true });
      await manager.getRepository(User).update({ id: userId },{ refreshTokenHash: null }, );
    
    });

  }

  isTokenExpired(token: RefreshToken): boolean {
    return new Date() > token.expiresAt;
  }
}
