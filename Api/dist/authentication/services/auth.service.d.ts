import { User } from '../../users/users.entity';
import { UsersService } from '../../users/users.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { ZohoAuthService } from './zoho-auth.service';
import { LoginResponseDto } from '../dto/login-response.dto';
export declare class AuthService {
    private usersService;
    private tokenService;
    private refreshTokenService;
    private zohoAuthService;
    constructor(usersService: UsersService, tokenService: TokenService, refreshTokenService: RefreshTokenService, zohoAuthService: ZohoAuthService);
    validateUserFromZoho(zohoProfile: any): Promise<LoginResponseDto>;
    loginWithEmail(email: string): Promise<LoginResponseDto>;
    refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: number): Promise<void>;
    validateUser(userId: number): Promise<User>;
    activateAccount(token: string): Promise<LoginResponseDto>;
    resendActivationEmail(userId: number): Promise<{
        token: string;
        user: User;
    }>;
}
