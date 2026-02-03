import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { UsersService } from '../../users/users.service';
export declare class RefreshTokenService {
    private refreshTokenRepository;
    private usersService;
    constructor(refreshTokenRepository: Repository<RefreshToken>, usersService: UsersService);
    saveToken(userId: number, token: string, expiresAt: Date): Promise<RefreshToken>;
    findValidToken(userId: number, token: string): Promise<RefreshToken | null>;
    revokeToken(tokenId: number): Promise<void>;
    revokeAllUserTokens(userId: number): Promise<void>;
    isTokenExpired(token: RefreshToken): boolean;
}
