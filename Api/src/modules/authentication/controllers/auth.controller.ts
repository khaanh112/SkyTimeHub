import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  Param,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { ZohoOAuthGuard } from '../guards/zoho-oauth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RefreshTokenDto, LoginEmailDto, AuthenticatedUser } from '../dto';
import { ActivateAccountDto } from '../dto/activate-account.dto';
import { ApiOperation, ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SuccessResponseDto } from '@/common/dto/success-response.dto';
import { AppException, ErrorCode } from '@/common';


@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Get('zoho')
  @UseGuards(ZohoOAuthGuard)
  @ApiOperation({ summary: 'Initiate Zoho OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Zoho OAuth page' })
  async zohoLogin() {
    //redirects to Zoho OAuth
  }

  @Public()
  @Get('zoho/callback')
  @UseGuards(ZohoOAuthGuard)
  @ApiOperation({ summary: 'Zoho OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async zohoCallback(@Req() req: any, @Res() res: Response) {
    this.logger.log('========== ZOHO CALLBACK START ==========');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    // Handle OAuth errors from Zoho (e.g., user denied access)
    const oauthError = req.query.error;
    if (oauthError) {
      this.logger.warn(`Zoho OAuth error: ${oauthError}`);
      
      const errorCode = oauthError === 'access_denied' ? 'access_denied' : 'OAUTH_ERROR';
      const errorMessage = encodeURIComponent(
        oauthError === 'access_denied' 
          ? 'Bạn đã từ chối quyền truy cập. Vui lòng thử lại và chấp nhận quyền để đăng nhập.'
          : 'Đăng nhập thất bại. Vui lòng thử lại.'
      );
      const redirectUrl = `${frontendUrl}/auth/callback?error=${errorCode}&message=${errorMessage}`;
      
      return res.redirect(redirectUrl);
    }

    try {
      this.logger.log(`Request user object: ${JSON.stringify(req.user)}`);
      
      const zohoProfile = {
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      };

      this.logger.log(`Zoho profile extracted - Email: ${zohoProfile.email}, Name: ${zohoProfile.firstName} ${zohoProfile.lastName}`);
      this.logger.log('Calling authService.validateUserFromZoho...');
      
      const loginResponse = await this.authService.validateUserFromZoho(zohoProfile);
      
      this.logger.log(`Validation successful - User ID: ${loginResponse.user.id}, Status: ${loginResponse.user.status}`);

      const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${loginResponse.accessToken}&refreshToken=${loginResponse.refreshToken}`;

      this.logger.log(`Redirecting to frontend with tokens`);
      this.logger.log('========== ZOHO CALLBACK SUCCESS ==========');
      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('========== ZOHO CALLBACK ERROR ==========');
      this.logger.error(`Error type: ${error.constructor.name}`);
      this.logger.error(`Error code: ${error.code || 'UNKNOWN'}`);
      this.logger.error(`Error message: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);

      const errorCode = error.code || 'INTERNAL_ERROR';
      const errorMessage = encodeURIComponent(
        error.message || 'Đăng nhập thất bại. Vui lòng thử lại.',
      );
      const redirectUrl = `${frontendUrl}/auth/callback?error=${errorCode}&message=${errorMessage}`;

      this.logger.log(`Redirecting to frontend with error: ${errorCode}`);
      this.logger.log('========== ZOHO CALLBACK FAILED ==========');
      return res.redirect(redirectUrl);
    }
  }

  //login with email
  @Public()
  @Post('login/email')
  @ApiOperation({ summary: 'Login with email (for testing)' })
  @ApiResponse({ status: 200, description: 'User logged in successfully.' })
  async loginWithEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginWithEmail(dto.email);
  }

  // =====================================================
  // TOKEN ENDPOINTS
  // =====================================================

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Access token refreshed successfully.' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  // =====================================================
  // SESSION ENDPOINTS
  // =====================================================

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully.' })
  async logout(@CurrentUser('id') userId: number, @CurrentUser() fullUser: AuthenticatedUser) {
    this.logger.log(`Logout endpoint called`);
    this.logger.log(`CurrentUser decorator returned userId: ${userId}`);
    this.logger.log(`Full user object: ${JSON.stringify(fullUser)}`);

    if (!userId) {
      this.logger.error(`Logout failed - No userId found in request`);
      throw new AppException(ErrorCode.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    this.logger.log(`Calling auth.service.logout for userId: ${userId}`);
    const result = await this.authService.logout(userId);
    this.logger.log(`Logout successful for userId: ${userId}`);
    return new SuccessResponseDto(result, 'User logged out successfully');
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile retrieved successfully.' })
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser, @Req() req) {
    this.logger.log(`Get current user endpoint called`);
    this.logger.log(`CurrentUser decorator returned: ${JSON.stringify(user)}`);
    this.logger.log(`Request user object: ${JSON.stringify(req.user)}`);

    if (!user) {
      this.logger.error(`No user found in request`);
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log(`Returning user profile for userId: ${user.id}`);
    return new SuccessResponseDto(user, 'Current user profile retrieved successfully');
  }

  // =====================================================
  // ACCOUNT ACTIVATION ENDPOINTS
  // =====================================================

  @Public()
  @Post('activate/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate user account' })
  @ApiResponse({ status: 200, description: 'User account activated successfully.' })
  async activateAccount(@Param() dto: ActivateAccountDto) {
    const result = await this.authService.activateAccount(dto.token);
    return new SuccessResponseDto(result, 'User account activated successfully');
  }

 
}
