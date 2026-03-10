import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import { ZohoProfileInterface } from '@/common/interfaces/zoho-profile.interface';
import { ZohoUserInfo } from '@/common/interfaces/zoho-user-info.interface';

@Injectable()
export class ZohoStrategy extends PassportStrategy(Strategy, 'zoho') {
  constructor(private configService: ConfigService) {
    const clientID = configService.getOrThrow<string>('ZOHO_CLIENT_ID');
    const clientSecret = configService.getOrThrow<string>('ZOHO_CLIENT_SECRET');
    const callbackURL = configService.getOrThrow<string>('ZOHO_CALLBACK_URL');

    super({
      authorizationURL: 'https://accounts.zoho.com/oauth/v2/auth',
      tokenURL: 'https://accounts.zoho.com/oauth/v2/token',
      clientID,
      clientSecret,
      callbackURL,
      scope: ['AaaServer.profile.READ'],
    });
  }
  authorizationParams(): Record<string, string> {
    return {
      prompt: 'consent', // Zoho: value must be "consent"
      access_type: 'offline', // nếu bạn cần refresh token
    };
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    _profile: Record<string, unknown>,
    done: VerifyCallback,
  ): Promise<void> {
    // Fetch user info from Zoho
    const response = await fetch('https://accounts.zoho.com/oauth/user/info', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userInfo = (await response.json()) as ZohoUserInfo;

    const user: ZohoProfileInterface = {
      email: userInfo.Email,
      firstName: userInfo.First_Name,
      lastName: userInfo.Last_Name,
      accessToken,
      refreshToken,
    };

    done(null, user);
  }
}
