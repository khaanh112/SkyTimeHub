import { UsersService } from '../../users/users.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { LoginResponseDto } from '../dto/login-response.dto';
interface ZohoProfile {
    email: string;
    firstName: string;
    lastName: string;
}
export declare class ZohoAuthService {
    private usersService;
    private tokenService;
    private refreshTokenService;
    constructor(usersService: UsersService, tokenService: TokenService, refreshTokenService: RefreshTokenService);
    validateAndLogin(zohoProfile: ZohoProfile): Promise<LoginResponseDto>;
    private findOrCreateUser;
}
export {};
