declare module 'passport-oauth2' {
  export interface StrategyOptions {
    authorizationURL: string;
    tokenURL: string;
    clientID: string;
    clientSecret: string;
    callbackURL?: string;
    scope?: string | string[];
    state?: boolean;
    passReqToCallback?: boolean;
  }

  export type VerifyCallback = (error: unknown, user?: unknown, info?: unknown) => void;

  export class Strategy {
    constructor(options: StrategyOptions, verify?: (...args: unknown[]) => void);
    name: string;
    authenticate(req: unknown, options?: unknown): void;
    authorizationParams?(options: Record<string, unknown>): Record<string, string>;
  }
}