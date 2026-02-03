import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UserStatus } from '../../common/enums/user-status.enum';
import { ZohoProfileDto } from '../dto/zoho-profile.dto';



@Injectable()
export class ZohoAuthService {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  async validateAndLogin(zohoProfile: ZohoProfileDto): Promise<LoginResponseDto> {
    const user = await this.findOrCreateUser(zohoProfile);

    const tokens = await this.tokenService.generateTokens(user);

    await this.refreshTokenService.saveToken(
      user.id,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiration(),
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    };
  }

  private async findOrCreateUser(profile: ZohoProfileDto): Promise<any> {
    const { email, firstName, lastName } = profile;

    let user = await this.usersService.getUserByEmail(email);

    if (!user) {
      user = await this.usersService.createUser({
        email,
        username: `${firstName} ${lastName}`.trim() || email.split('@')[0],
      });
    } else if (user.activationToken) {
      // User was created by HR but hasn't activated account yet
      throw new UnauthorizedException(
        'Account not activated. Please check your email and click the activation link first.',
      );
    } else if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active, contact HR department.');
    }

    return user;
  }
}
