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
exports.ZohoStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_oauth2_1 = require("passport-oauth2");
const config_1 = require("@nestjs/config");
let ZohoStrategy = class ZohoStrategy extends (0, passport_1.PassportStrategy)(passport_oauth2_1.Strategy, 'zoho') {
    constructor(configService) {
        const clientID = configService.get('ZOHO_CLIENT_ID');
        const clientSecret = configService.get('ZOHO_CLIENT_SECRET');
        const callbackURL = configService.get('ZOHO_CALLBACK_URL');
        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error('Missing required Zoho OAuth configuration');
        }
        super({
            authorizationURL: 'https://accounts.zoho.com/oauth/v2/auth',
            tokenURL: 'https://accounts.zoho.com/oauth/v2/token',
            clientID,
            clientSecret,
            callbackURL,
            scope: ['AaaServer.profile.READ'],
        });
        this.configService = configService;
    }
    async validate(accessToken, refreshToken, profile, done) {
        const response = await fetch('https://accounts.zoho.com/oauth/user/info', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const userInfo = await response.json();
        const user = {
            email: userInfo.Email,
            firstName: userInfo.First_Name,
            lastName: userInfo.Last_Name,
            picture: userInfo.picture || '',
            accessToken,
            refreshToken,
        };
        done(null, user);
    }
};
exports.ZohoStrategy = ZohoStrategy;
exports.ZohoStrategy = ZohoStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ZohoStrategy);
//# sourceMappingURL=zoho.strategy.js.map