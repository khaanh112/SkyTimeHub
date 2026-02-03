import { ApiSuccessResponse } from '../types/api-response.type';

/**
 * DTO wrapper cho success responses
 */
export class SuccessResponseDto<T = unknown> implements ApiSuccessResponse<T> {
  readonly success = true as const;
  data: T;
  message?: string;
  timestamp: string;
  path?: string;

  constructor(data: T, message?: string) {
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static create<T>(data: T, message?: string): SuccessResponseDto<T> {
    return new SuccessResponseDto(data, message);
  }
}
