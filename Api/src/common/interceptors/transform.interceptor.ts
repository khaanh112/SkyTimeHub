import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiSuccessResponse } from '../types/api-response.type';

/**
 * Interceptor để transform tất cả responses thành format thống nhất
 * Áp dụng cho success responses - error responses được xử lý bởi GlobalExceptionFilter
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.originalUrl ?? req.url;

    return next.handle().pipe(
      map((data) => {
        // Nếu data đã là format chuẩn (có success field), giữ nguyên
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiSuccessResponse<T>;
        }

        // Wrap data vào format chuẩn
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path,
        };
      }),
    );
  }
}
