/**
 * Cấu trúc response API thống nhất cho success responses
 */
export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  path?: string;
};

/**
 * Cấu trúc response API thống nhất cho error responses
 */
export type ApiErrorResponse = {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
};

/**
 * Union type cho tất cả các responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
