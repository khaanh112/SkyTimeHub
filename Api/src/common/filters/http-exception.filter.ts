import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError } from '../errors/api-error.type';
import { ErrorCode } from '../enums/errror-code.enum';
import { AppException } from '../exceptions/app.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = req.originalUrl ?? req.url;

    // 1) AppException -> giữ nguyên code/message/details
    if (exception instanceof AppException) {
      const status = exception.getStatus();
      const r = exception.getResponse() as any;

      return res.status(status).json({
        code: r.code,
        message: r.message,
        details: r.details,
        timestamp,
        path,
      });
    }

    // 2) HttpException khác (BadRequest, NotFound, v.v.) -> chuyển đổi sang định dạng chuẩn
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse() as any;

      // ValidationPipe thường là BadRequestException với message array
      if (exception instanceof BadRequestException && Array.isArray(payload?.message)) {
        return res.status(status).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: payload.message,
          timestamp,
          path,
        });
      }

      // Các HttpException khác
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload?.message === 'string'
            ? payload.message
            : exception.message;

      return res.status(status).json({
        code: payload?.code ?? 'HTTP_EXCEPTION',
        message,
        details: payload?.details,
        timestamp,
        path,
      });
    }

    // 3) Unknown error -> 500 chuẩn
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      timestamp,
      path,
    });
  }
}
