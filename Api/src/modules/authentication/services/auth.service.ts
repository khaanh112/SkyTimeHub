import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { User } from '@entities/users.entity';
import { UsersService } from '@modules/users/users.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { ZohoAuthService } from './zoho-auth.service';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UserStatus } from '@common/enums/user-status.enum';
import { ZohoProfileDto } from '../dto/zoho-profile.dto';
import { AppException } from '@common/exceptions/app.exception';
import { ErrorCode } from '@common/enums/errror-code.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private refreshTokenService: RefreshTokenService,
    private zohoAuthService: ZohoAuthService,
  ) {}


  async validateUserFromZoho(zohoProfile: ZohoProfileDto): Promise<LoginResponseDto> {
    try {
      this.logger.log(`Validating user from Zoho: ${zohoProfile?.email || 'unknown'}`);
      const result = await this.zohoAuthService.validateAndLogin(zohoProfile);
      this.logger.log(`Successfully validated user from Zoho: ${result.user.email}`);
      return result;
    } catch (error) {
      this.logger.warn(`Zoho login denied for ${zohoProfile?.email}: ${error.message}`);
      throw error;
    }
  }

  // =====================================================
  // EMAIL LOGIN (FOR TESTING)
  // =====================================================

  async loginWithEmail(email: string): Promise<LoginResponseDto> {
    try {
      this.logger.log(`Attempting login with email: ${email}`);

      // Find or create user by email
      let user = await this.usersService.getUserByEmail(email);

      if (user.status !== UserStatus.ACTIVE) {
        this.logger.warn(`User account not active: ${user.id}, status: ${user.status}`);
        throw new AppException(
          ErrorCode.ACCOUNT_NOT_ACTIVE,
          'User account is not active, contact HR department.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Generate tokens
      this.logger.log(`Generating tokens for user: ${user.id}`);
      const tokens = await this.tokenService.generateTokens(user);

      // Save refresh token
      this.logger.log(`Saving refresh token for user: ${user.id}`);
      await this.refreshTokenService.saveToken(
        user.id,
        tokens.refreshToken,
        this.tokenService.getRefreshTokenExpiration(),
      );

      this.logger.log(`Login successful for user: ${user.id}`);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
        },
      };
    } catch (error) {
      this.logger.error(`Login error for email ${email}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =====================================================
  // TOKEN MANAGEMENT
  // =====================================================

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      this.logger.log('Attempting to refresh access token');
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      this.logger.log(`Token verified for user: ${payload.sub}`);

      const storedToken = await this.refreshTokenService.findValidToken(payload.sub, refreshToken);

      if (!storedToken) {
        this.logger.warn(`Invalid refresh token for user: ${payload.sub}`);
        throw new AppException(
          ErrorCode.INVALID_REFRESH_TOKEN,
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (this.refreshTokenService.isTokenExpired(storedToken)) {
        this.logger.warn(`Refresh token expired for user: ${payload.sub}`);
        await this.refreshTokenService.revokeToken(storedToken.id);
        throw new AppException(
          ErrorCode.REFRESH_TOKEN_EXPIRED,
          'Refresh token expired',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const user = await this.usersService.getUser(payload.sub);

      if (!user || user.status !== UserStatus.ACTIVE) {
        this.logger.warn(`User not active: ${payload.sub}`);
        throw new AppException(
          ErrorCode.ACCOUNT_NOT_ACTIVE,
          'User not active',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const tokens = await this.tokenService.generateTokens(user);

      await this.refreshTokenService.revokeToken(storedToken.id);
      await this.refreshTokenService.saveToken(
        user.id,
        tokens.refreshToken,
        this.tokenService.getRefreshTokenExpiration(),
      );

      this.logger.log(`Token refreshed successfully for user: ${user.id}`);
      return tokens;
    } catch (error) {
      this.logger.error(`Error refreshing token: ${error.message}`, error.stack);
      if (error instanceof AppException) {
        throw error;
      }
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================

  async logout(userId: number): Promise<void> {
    if (!userId) {
      this.logger.warn('Logout called without userId');
      return; // Silent fail if no userId
    }
    this.logger.log(`Logging out user: ${userId}`);
    await this.refreshTokenService.revokeAllUserTokens(userId);
    this.logger.log(`User logged out successfully: ${userId}`);
  }

  
  /**
   * Activate user account via activation token
   * Used when user clicks activation link from invitation email
   */
  async activateAccount(token: string): Promise<{ email: string; username: string }> {
    try {
      this.logger.log('Attempting to activate account');
      // Activate the account
      const user = await this.usersService.activateAccount(token);
      this.logger.log(`Account activated for user: ${user.id}`);

      return {
        email: user.email,
        username: user.username,
      };
    } catch (error) {
      this.logger.error(`Account activation failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
