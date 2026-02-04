# Zoho OAuth Authentication Flow

## Overview
Hệ thống sử dụng Zoho OAuth 2.0 để xác thực người dùng. Flow này cho phép users đăng nhập bằng tài khoản Zoho của họ thông qua giao thức OAuth 2.0 chuẩn.

## Architecture Components

### 1. Files Involved
- **Strategy**: `src/modules/authentication/strategies/zoho.strategy.ts`
- **Guard**: `src/modules/authentication/guards/zoho-oauth.guard.ts`
- **Controller**: `src/modules/authentication/controllers/auth.controller.ts`
- **Services**: 
  - `src/modules/authentication/services/auth.service.ts`
  - `src/modules/authentication/services/zoho-auth.service.ts`
  - `src/modules/authentication/services/token.service.ts`
  - `src/modules/authentication/services/refresh-token.service.ts`

### 2. DTOs
- **ZohoProfileDto**: User profile data từ Zoho
- **LoginResponseDto**: Response chứa access token, refresh token và user info
- **AuthenticatedUser**: User data trong request sau khi authenticate

## Complete Authentication Flow

```
┌─────────┐         ┌──────────┐         ┌──────────────┐         ┌──────────┐
│ Client  │         │   API    │         │ Zoho OAuth   │         │ Database │
└────┬────┘         └────┬─────┘         └──────┬───────┘         └────┬─────┘
     │                   │                       │                       │
     │ 1. GET /auth/zoho │                       │                       │
     ├──────────────────►│                       │                       │
     │                   │                       │                       │
     │                   │ 2. Redirect to Zoho   │                       │
     │                   │   Authorization Page  │                       │
     │◄──────────────────┤                       │                       │
     │                   │                       │                       │
     │ 3. User Consents  │                       │                       │
     ├───────────────────┼──────────────────────►│                       │
     │                   │                       │                       │
     │                   │ 4. Callback with code │                       │
     │                   │◄──────────────────────┤                       │
     │                   │                       │                       │
     │                   │ 5. Exchange code      │                       │
     │                   │    for access token   │                       │
     │                   ├──────────────────────►│                       │
     │                   │                       │                       │
     │                   │ 6. Access Token       │                       │
     │                   │◄──────────────────────┤                       │
     │                   │                       │                       │
     │                   │ 7. Fetch user info    │                       │
     │                   ├──────────────────────►│                       │
     │                   │                       │                       │
     │                   │ 8. User Profile       │                       │
     │                   │◄──────────────────────┤                       │
     │                   │                       │                       │
     │                   │ 9. Find or Create User│                       │
     │                   ├───────────────────────┼──────────────────────►│
     │                   │                       │                       │
     │                   │ 10. User Record       │                       │
     │                   │◄──────────────────────┼───────────────────────┤
     │                   │                       │                       │
     │                   │ 11. Generate JWT      │                       │
     │                   │    Tokens             │                       │
     │                   ├───────────────────────┼──────────────────────►│
     │                   │                       │                       │
     │ 12. Redirect to   │                       │                       │
     │     Frontend with │                       │                       │
     │     Tokens        │                       │                       │
     │◄──────────────────┤                       │                       │
     │                   │                       │                       │
```

## Step-by-Step Flow

### Step 1: Initiate OAuth Flow
**Endpoint**: `GET /auth/zoho`

```typescript
@Public()
@Get('zoho')
@UseGuards(ZohoOAuthGuard)
async zohoLogin() {
  //redirects to Zoho OAuth
}
```

**Process**:
1. User truy cập `/auth/zoho`
2. `ZohoOAuthGuard` được trigger
3. Guard sử dụng `ZohoStrategy` để redirect user đến Zoho authorization page
4. URL redirect bao gồm: `clientID`, `scope`, `callbackURL`

**Zoho Authorization URL**: 
```
https://accounts.zoho.com/oauth/v2/auth
  ?client_id={CLIENT_ID}
  &scope=AaaServer.profile.READ
  &redirect_uri={CALLBACK_URL}
  &response_type=code
```

### Step 2: User Authorization
User đăng nhập vào Zoho và cho phép ứng dụng truy cập thông tin profile của họ.

### Step 3: OAuth Callback
**Endpoint**: `GET /auth/zoho/callback`

```typescript
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

  const frontendUrl = this.configService.get<string>('FRONTEND_URL');
  const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${loginResponse.accessToken}&refreshToken=${loginResponse.refreshToken}`;

  return res.redirect(redirectUrl);
}
```

**Process**:
1. Zoho redirect về `/auth/zoho/callback?code={CODE}`
2. `ZohoOAuthGuard` trigger `ZohoStrategy.validate()`
3. Strategy thực hiện:
   - Exchange authorization code cho access token
   - Fetch user info từ Zoho API
   - Return user profile

### Step 4: ZohoStrategy Validation

**File**: `zoho.strategy.ts`

```typescript
async validate(
  accessToken: string,
  refreshToken: string,
  profile: Record<string, unknown>,
  done: VerifyCallback,
): Promise<void> {
  // Fetch user info from Zoho
  const response = await fetch('https://accounts.zoho.com/oauth/user/info', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const userInfo = (await response.json()) as ZohoUserInfo;

  const user: ZohoProfile = {
    email: userInfo.Email,
    firstName: userInfo.First_Name,
    lastName: userInfo.Last_Name,
    picture: userInfo.picture || '',
    accessToken,
    refreshToken,
  };

  done(null, user);
}
```

**Process**:
1. Gọi Zoho User Info API với access token
2. Parse response và tạo `ZohoProfile` object
3. Passport tự động gán user vào `req.user`

### Step 5: Validate and Login User

**Service Chain**:
```
AuthController.zohoCallback()
  → AuthService.validateUserFromZoho()
    → ZohoAuthService.validateAndLogin()
      → ZohoAuthService.findOrCreateUser()
      → TokenService.generateTokens()
      → RefreshTokenService.saveToken()
```

**File**: `zoho-auth.service.ts`

```typescript
async validateAndLogin(zohoProfile: ZohoProfileDto): Promise<LoginResponseDto> {
  // 1. Find or create user
  const user = await this.findOrCreateUser(zohoProfile);

  // 2. Generate JWT tokens
  const tokens = await this.tokenService.generateTokens(user);

  // 3. Save refresh token to database
  await this.refreshTokenService.saveToken(
    user.id,
    tokens.refreshToken,
    this.tokenService.getRefreshTokenExpiration(),
  );

  // 4. Return tokens and user info
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
```

### Step 6: Find or Create User

```typescript
private async findOrCreateUser(profile: ZohoProfileDto): Promise<User> {
  const { email, firstName, lastName } = profile;

  let user = await this.usersService.getUserByEmail(email);

  if (!user) {
    // Create new user
    user = await this.usersService.createUser({
      email,
      username: `${firstName} ${lastName}`.trim() || email.split('@')[0],
    });
  } else if (user.activationToken) {
    // User created by HR but not activated
    throw new UnauthorizedException(
      'Account not activated. Please check your email and click the activation link first.',
    );
  } else if (user.status !== UserStatus.ACTIVE) {
    // User account is inactive
    throw new UnauthorizedException(
      'User account is not active, contact HR department.'
    );
  }

  return user;
}
```

**Business Logic**:
- **New User**: Tạo user mới với status ACTIVE
- **Existing User with Activation Token**: User đã được tạo bởi HR nhưng chưa activate → reject
- **Inactive User**: User bị deactivate → reject
- **Active User**: Allow login

### Step 7: Generate JWT Tokens

**TokenService** tạo 2 loại tokens:
- **Access Token**: Short-lived JWT (ví dụ: 15 minutes)
- **Refresh Token**: Long-lived JWT (ví dụ: 7 days)

**JWT Payload Structure**:
```typescript
{
  sub: user.id,        // User ID
  email: user.email,
  username: user.username,
  role: user.role,
  iat: timestamp,      // Issued at
  exp: timestamp       // Expiration
}
```

### Step 8: Save Refresh Token

Refresh token được lưu vào database (`refresh_tokens` table) để:
- Quản lý và thu hồi tokens
- Implement logout functionality
- Track active sessions

### Step 9: Redirect to Frontend

Controller redirect về frontend với tokens trong query params:

```
{FRONTEND_URL}/auth/callback?accessToken={JWT}&refreshToken={JWT}
```

Frontend sẽ:
1. Lấy tokens từ URL
2. Lưu vào localStorage/cookies
3. Redirect user vào application

## Configuration

### Environment Variables Required

```env
# Zoho OAuth Configuration
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_CALLBACK_URL=http://localhost:3000/auth/zoho/callback

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Zoho OAuth Setup

1. Đăng ký application tại [Zoho API Console](https://api-console.zoho.com/)
2. Configure:
   - **Client Domain**: Domain của backend
   - **Authorized Redirect URIs**: `{BACKEND_URL}/auth/zoho/callback`
   - **Scopes**: `AaaServer.profile.READ`
3. Lấy `Client ID` và `Client Secret`

## Security Considerations

### 1. Token Security
- Access tokens có thời gian sống ngắn (15 minutes)
- Refresh tokens có thời gian sống dài hơn nhưng được lưu an toàn trong database
- Tokens được signed với JWT_SECRET

### 2. User Validation
- Verify user status trước khi issue tokens
- Check activation status cho users được tạo bởi HR
- Handle inactive accounts

### 3. Data Flow
- User data từ Zoho chỉ được dùng để authenticate và create/update user record
- Không lưu Zoho access/refresh tokens trong database
- Chỉ expose cần thiết user info trong response

## Error Handling

### Common Errors

| Error | Cause | Status Code |
|-------|-------|-------------|
| `Missing required Zoho OAuth configuration` | Thiếu env variables | 500 |
| `Account not activated` | User có activation token | 401 |
| `User account is not active` | User status ≠ ACTIVE | 401 |
| `Invalid token` | JWT verification failed | 401 |

## API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/zoho` | GET | Public | Initiate Zoho OAuth flow |
| `/auth/zoho/callback` | GET | Public | OAuth callback handler |
| `/auth/refresh` | POST | Public | Refresh access token |
| `/auth/logout` | POST | Required | Logout and invalidate tokens |
| `/auth/me` | GET | Required | Get current user profile |

## Testing

### Manual Testing Flow

1. **Start OAuth Flow**:
   ```bash
   curl http://localhost:3000/auth/zoho
   ```
   → Redirects to Zoho login

2. **Complete Authorization**: 
   - Login to Zoho
   - Grant permissions
   - Get redirected back to callback

3. **Verify Tokens**:
   - Check frontend receives tokens
   - Verify tokens are valid JWTs
   - Test access token works with protected endpoints

4. **Test Refresh**:
   ```bash
   curl -X POST http://localhost:3000/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
   ```

## Future Enhancements

- [ ] Add support for multiple OAuth providers (Google, Microsoft)
- [ ] Implement token rotation for refresh tokens
- [ ] Add rate limiting for OAuth endpoints
- [ ] Store Zoho profile picture in user record
- [ ] Implement automatic token refresh on frontend
- [ ] Add audit logging for authentication events
