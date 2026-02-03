import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../../users/users.entity';
import { UsersService } from '../../users/users.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { ZohoAuthService } from './zoho-auth.service';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UserStatus } from '../../common/enums/user-status.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private refreshTokenService: RefreshTokenService,
    private zohoAuthService: ZohoAuthService,
  ) {}

  // =====================================================
  // ZOHO OAUTH
  // =====================================================

  async validateUserFromZoho(zohoProfile: any): Promise<LoginResponseDto> {
    return this.zohoAuthService.validateAndLogin(zohoProfile);
  }

  // =====================================================
  // EMAIL LOGIN (FOR TESTING)
  // =====================================================

  async loginWithEmail(email: string): Promise<LoginResponseDto> {
    // Find or create user by email
    let user = await this.usersService.getUserByEmail(email);
    
    if (!user) {
      // Create new user if not exists
      user = await this.usersService.createUser({
        email,
        username: email.split('@')[0],
        status: UserStatus.ACTIVE,
      });
    }

    if(user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active, contact HR department.');
    }
    

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user);

    // Save refresh token
    await this.refreshTokenService.saveToken(
      user.id,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiration(),
    );

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
  }

  // =====================================================
  // TOKEN MANAGEMENT
  // =====================================================

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      const storedToken = await this.refreshTokenService.findValidToken(payload.sub, refreshToken);

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (this.refreshTokenService.isTokenExpired(storedToken)) {
        await this.refreshTokenService.revokeToken(storedToken.id);
        throw new UnauthorizedException('Refresh token expired');
      }

      const user = await this.usersService.getUser(payload.sub);

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User not active');
      }

      const tokens = await this.tokenService.generateTokens(user);

      await this.refreshTokenService.revokeToken(storedToken.id);
      await this.refreshTokenService.saveToken(
        user.id,
        tokens.refreshToken,
        this.tokenService.getRefreshTokenExpiration(),
      );

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================

  async logout(userId: number): Promise<void> {
    if (!userId) {
      return; // Silent fail if no userId
    }
    await this.refreshTokenService.revokeAllUserTokens(userId);
  }

  // =====================================================
  // USER VALIDATION
  // =====================================================

  async validateUser(userId: number): Promise<User> {
    const user = await this.usersService.getUser(userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    return user;
  }

  // =====================================================
  // ACCOUNT ACTIVATION
  // =====================================================

  /**
   * Activate user account via activation token
   * Used when user clicks activation link from invitation email
   */
  async activateAccount(token: string): Promise<LoginResponseDto> {
    // Activate the account
    const user = await this.usersService.activateAccount(token);

    // Generate tokens for auto-login after activation
    const tokens = await this.tokenService.generateTokens(user);

    // Save refresh token
    await this.refreshTokenService.saveToken(
      user.id,
      tokens.refreshToken,
      this.tokenService.getRefreshTokenExpiration(),
    );

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
  }

  /**
   * Resend activation email
   * Generates new activation token and returns it for email service
   */
  async resendActivationEmail(userId: number): Promise<{ token: string; user: User }> {
    const user = await this.usersService.resendActivation(userId);
    
    return {
      token: user.activationToken,
      user,
    };
  }
}
