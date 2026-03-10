import { Request } from 'express';

export interface ZohoProfileInterface {
  email: string;
  firstName: string;
  lastName: string;
  accessToken: string;
  refreshToken: string;
}

export interface ZohoCallbackQuery {
  error?: string;
}

export interface ZohoRequest extends Request {
  user: ZohoProfileInterface;
  query: ZohoCallbackQuery & Request['query'];
}
