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
exports.ZohoAuthService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("../../users/users.service");
const token_service_1 = require("./token.service");
const refresh_token_service_1 = require("./refresh-token.service");
const user_status_enum_1 = require("../../common/enums/user-status.enum");
let ZohoAuthService = class ZohoAuthService {
    constructor(usersService, tokenService, refreshTokenService) {
        this.usersService = usersService;
        this.tokenService = tokenService;
        this.refreshTokenService = refreshTokenService;
    }
    async validateAndLogin(zohoProfile) {
        const user = await this.findOrCreateUser(zohoProfile);
        const tokens = await this.tokenService.generateTokens(user);
        await this.refreshTokenService.saveToken(user.id, tokens.refreshToken, this.tokenService.getRefreshTokenExpiration());
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
    async findOrCreateUser(profile) {
        const { email, firstName, lastName } = profile;
        let user = await this.usersService.findByEmail(email);
        if (!user) {
            user = await this.usersService.createUser({
                email,
                username: `${firstName} ${lastName}`.trim() || email.split('@')[0],
            });
        }
        else if (user.activationToken) {
            throw new common_1.UnauthorizedException('Account not activated. Please check your email and click the activation link first.');
        }
        else if (user.status !== user_status_enum_1.UserStatus.ACTIVE) {
            throw new common_1.UnauthorizedException('User account is not active, contact HR department.');
        }
        return user;
    }
};
exports.ZohoAuthService = ZohoAuthService;
exports.ZohoAuthService = ZohoAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        token_service_1.TokenService,
        refresh_token_service_1.RefreshTokenService])
], ZohoAuthService);
//# sourceMappingURL=zoho-auth.service.js.map