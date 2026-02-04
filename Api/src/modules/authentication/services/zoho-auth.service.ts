import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UserStatus } from '@common/enums/user-status.enum';
import { ErrorCode } from '@common/enums/errror-code.enum';
import { AppException } from '@common/exceptions/app.exception';
import { ZohoProfileDto } from '../dto/zoho-profile.dto';
import { User } from '@/entities/users.entity';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class ZohoAuthService {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  async validateAndLogin(zohoProfile: ZohoProfileDto): Promise<LoginResponseDto> {
    const user = await this.findCreatedUser(zohoProfile);

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

  private async findCreatedUser(profile: ZohoProfileDto): Promise<User> {
    const { email } = profile;

    const user = await this.usersService.getUserByEmail(email);

    // User must be invited by HR first
    if (!user) {
      throw new AppException(
        ErrorCode.ACCOUNT_NOT_INVITED,
        'Account not found. Please contact HR department to get an invitation first.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // User must activate account before logging in
    if (user.activationToken) {
      throw new AppException(
        ErrorCode.ACCOUNT_NOT_ACTIVATED,
        'Account not activated. Please check your email and click the activation link first.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // User account must be active
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.ACCOUNT_INACTIVE,
        'User account is not active. Please contact HR department.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return user;
  }
}
