import { ConfigService } from '@nestjs/config';
declare const ZohoStrategy_base: new (...args: any) => any;
export declare class ZohoStrategy extends ZohoStrategy_base {
    private configService;
    constructor(configService: ConfigService);
    validate(accessToken: string, refreshToken: string, profile: any, done: any): Promise<any>;
}
export {};
