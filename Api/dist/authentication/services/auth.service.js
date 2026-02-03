"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("../../users/users.service");
const token_service_1 = require("./token.service");
const refresh_token_service_1 = require("./refresh-token.service");
const zoho_auth_service_1 = require("./zoho-auth.service");
const user_status_enum_1 = require("../../common/enums/user-status.enum");
let AuthService = class AuthService {
    constructor(usersService, tokenService, refreshTokenService, zohoAuthService) {
        this.usersService = usersService;
        this.tokenService = tokenService;
        this.refreshTokenService = refreshTokenService;
        this.zohoAuthService = zohoAuthService;
    }
    async validateUserFromZoho(zohoProfile) {
        return this.zohoAuthService.validateAndLogin(zohoProfile);
    }
    async loginWithEmail(email) {
        let user = await this.usersService.getUserByEmail(email);
        if (!user) {
            user = await this.usersService.createUser({
                email,
                username: email.split('@')[0],
                status: user_status_enum_1.UserStatus.ACTIVE,
            });
        }
        if (user.status !== user_status_enum_1.UserStatus.ACTIVE) {
            throw new common_1.UnauthorizedException('User account is not active, contact HR department.');
        }
        const tokens = await this.tokenService.generateTokens(user);
        await this.refreshTokenService.saveToken(user.id, tokens.refreshToken, this.tokenService.getRefreshTokenExpiration());
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
    async refreshAccessToken(refreshToken) {
        try {
            const payload = await this.tokenService.verifyRefreshToken(refreshToken);
            const storedToken = await this.refreshTokenService.findValidToken(payload.sub, refreshToken);
            if (!storedToken) {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            if (this.refreshTokenService.isTokenExpired(storedToken)) {
                await this.refreshTokenService.revokeToken(storedToken.id);
                throw new common_1.UnauthorizedException('Refresh token expired');
            }
            const user = await this.usersService.getUser(payload.sub);
            if (!user || user.status !== user_status_enum_1.UserStatus.ACTIVE) {
                throw new common_1.UnauthorizedException('User not active');
            }
            const tokens = await this.tokenService.generateTokens(user);
            await this.refreshTokenService.revokeToken(storedToken.id);
            await this.refreshTokenService.saveToken(user.id, tokens.refreshToken, this.tokenService.getRefreshTokenExpiration());
            return tokens;
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
    }
    async logout(userId) {
        if (!userId) {
            return;
        }
        await this.refreshTokenService.revokeAllUserTokens(userId);
    }
    async validateUser(userId) {
        const user = await this.usersService.getUser(userId);
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        if (user.status !== user_status_enum_1.UserStatus.ACTIVE) {
            throw new common_1.UnauthorizedException('User account is not active');
        }
        return user;
    }
    async activateAccount(token) {
        const user = await this.usersService.activateAccount(token);
        const tokens = await this.tokenService.generateTokens(user);
        await this.refreshTokenService.saveToken(user.id, tokens.refreshToken, this.tokenService.getRefreshTokenExpiration());
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
    async resendActivationEmail(userId) {
        const user = await this.usersService.resendActivation(userId);
        return {
            token: user.activationToken,
            user,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        token_service_1.TokenService,
        refresh_token_service_1.RefreshTokenService,
        zoho_auth_service_1.ZohoAuthService])
], AuthService);
//# sourceMappingURL=auth.service.js.map