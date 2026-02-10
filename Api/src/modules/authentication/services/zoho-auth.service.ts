import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(ZohoAuthService.name);

  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  async validateAndLogin(zohoProfile: ZohoProfileDto): Promise<LoginResponseDto> {
    this.logger.log('========== ZOHO AUTH SERVICE START ==========');
    this.logger.log(`Validating login for email: ${zohoProfile.email}`);

    const user = await this.findCreatedUser(zohoProfile);
    this.logger.log(`User found and validated - ID: ${user.id}, Email: ${user.email}`);

    this.logger.log('Generating JWT tokens...');
    const tokens = await this.tokenService.generateTokens(user);
    this.logger.log('Tokens generated successfully');

    this.logger.log('Saving refresh token...');
    await this.refreshTokenService.saveToken(
      user.id,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiration(),
    );
    this.logger.log('Refresh token saved');

    this.logger.log('========== ZOHO AUTH SERVICE SUCCESS ==========');
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

    this.logger.log('--- Checking user in database ---');
    this.logger.log(`Looking up user by email: ${email}`);

    const user = await this.usersService.getUserByEmail(email);

    // User must be invited by HR first
    if (!user) {
      this.logger.error(`❌ User not found in database for email: ${email}`);
      this.logger.error('User needs to be invited by HR first');
      throw new AppException(
        ErrorCode.ACCOUNT_NOT_INVITED,
        'Account not found. Please contact HR department to get an invitation first.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log(`✓ User found in database`);
    this.logger.log(`   - User ID: ${user.id}`);
    this.logger.log(`   - Email: ${user.email}`);
    this.logger.log(`   - Username: ${user.username}`);
    this.logger.log(`   - Status: ${user.status}`);
    this.logger.log(
      `   - Activation Token: ${user.activationToken ? 'EXISTS (not activated yet)' : 'NULL (activated)'}`,
    );
    this.logger.log(`   - Activated At: ${user.activatedAt || 'NULL'}`);

    // User must activate account before logging in
    if (user.activationToken) {
      this.logger.error(`❌ Account not activated yet`);
      this.logger.error(`   - Activation token still exists: ${user.activationToken}`);
      this.logger.error(`   - User needs to click activation link first`);
      throw new AppException(
        ErrorCode.ACCOUNT_NOT_ACTIVATED,
        'Account not activated. Please check your email and click the activation link first.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log(`✓ Activation token check passed (token is NULL)`);

    // User account must be active
    if (user.status !== UserStatus.ACTIVE) {
      this.logger.error(`❌ User status is not ACTIVE`);
      this.logger.error(`   - Current status: ${user.status}`);
      this.logger.error(`   - Expected status: ${UserStatus.ACTIVE}`);
      throw new AppException(
        ErrorCode.ACCOUNT_NOT_ACTIVE,
        'User account is not active. Please contact HR department.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log(`✓ User status check passed (status is ACTIVE)`);
    this.logger.log('--- All validation checks passed ---');

    return user;
  }
}
