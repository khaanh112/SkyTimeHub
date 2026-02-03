import { Controller, Get, Post, Body, UseGuards, Req, Res, HttpStatus, HttpCode, Param } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { ZohoOAuthGuard } from '../guards/zoho-oauth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RefreshTokenDto, LoginEmailDto } from '../dto';
import { ActivateAccountDto } from '../dto/activate-account.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}



  @Public()
  @Get('zoho')
  @UseGuards(ZohoOAuthGuard)
  async zohoLogin() {
    // Guard redirects to Zoho OAuth page
  }

  @Public()
  @Get('zoho/callback')
  @UseGuards(ZohoOAuthGuard)
  async zohoCallback(@Req() req: any, @Res() res: Response) {
    const zohoProfile = {
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    };

    const loginResponse = await this.authService.validateUserFromZoho(zohoProfile);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${loginResponse.accessToken}&refreshToken=${loginResponse.refreshToken}`;
    
    return res.redirect(redirectUrl);
  }

  // =====================================================
  // EMAIL LOGIN (FOR TESTING)
  // =====================================================

  @Public()
  @Post('login/email')
  @HttpCode(HttpStatus.OK)
  async loginWithEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginWithEmail(dto.email);
  }

  // =====================================================
  // TOKEN ENDPOINTS
  // =====================================================

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  // =====================================================
  // SESSION ENDPOINTS
  // =====================================================

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: number) {
    if (!userId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid user session',
      };
    }
    
    await this.authService.logout(userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Logged out successfully',
    };
  }

  // =====================================================
  // USER PROFILE ENDPOINTS
  // =====================================================

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  // =====================================================
  // ACCOUNT ACTIVATION ENDPOINTS
  // =====================================================

  @Public()
  @Post('activate/:token')
  @HttpCode(HttpStatus.OK)
  async activateAccount(@Param() dto: ActivateAccountDto) {
    return this.authService.activateAccount(dto.token);
  }

  @Post('resend-activation')
  @HttpCode(HttpStatus.OK)
  async resendActivation(@CurrentUser('id') userId: number) {
    const result = await this.authService.resendActivationEmail(userId);
    
    // TODO: Send activation email here
    // await this.emailService.sendActivationEmail(result.user.email, result.token);
    
    return {
      statusCode: HttpStatus.OK,
      message: 'Activation email sent successfully',
    };
  }
}
