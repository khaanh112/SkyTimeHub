import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/users.entity';
import { JwtPayload } from '../dto/jwt-payload.dto';
export declare class TokenService {
    private jwtService;
    private configService;
    constructor(jwtService: JwtService, configService: ConfigService);
    generateTokens(user: User): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    generateAccessToken(payload: JwtPayload): Promise<string>;
    generateRefreshToken(payload: JwtPayload): Promise<string>;
    verifyRefreshToken(token: string): Promise<JwtPayload>;
    verifyAccessToken(token: string): Promise<JwtPayload>;
    getRefreshTokenExpiration(): Date;
}
