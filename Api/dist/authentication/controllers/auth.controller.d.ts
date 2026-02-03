import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { RefreshTokenDto, LoginEmailDto } from '../dto';
import { ActivateAccountDto } from '../dto/activate-account.dto';
export declare class AuthController {
    private authService;
    private configService;
    constructor(authService: AuthService, configService: ConfigService);
    zohoLogin(): Promise<void>;
    zohoCallback(req: any, res: Response): Promise<void>;
    loginWithEmail(dto: LoginEmailDto): Promise<import("../dto").LoginResponseDto>;
    refreshToken(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: number): Promise<{
        statusCode: HttpStatus;
        message: string;
    }>;
    getProfile(user: any): Promise<any>;
    activateAccount(dto: ActivateAccountDto): Promise<import("../dto").LoginResponseDto>;
    resendActivation(userId: number): Promise<{
        statusCode: HttpStatus;
        message: string;
    }>;
}
