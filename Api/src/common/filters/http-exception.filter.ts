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
import { ApiErrorResponse } from '../types/api-response.type';
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
      const r = exception.getResponse() as ApiError;

      const response: ApiErrorResponse = {
        success: false,
        code: r.code,
        message: r.message,
        details: r.details,
        timestamp,
        path,
      };

      return res.status(status).json(response);
    }

    // 2) HttpException khác (BadRequest, NotFound, v.v.) -> chuyển đổi sang định dạng chuẩn
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse() as ApiError;

      // ValidationPipe thường là BadRequestException với message array
      if (exception instanceof BadRequestException && Array.isArray(payload?.message)) {
        const response: ApiErrorResponse = {
          success: false,
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: payload.message,
          timestamp,
          path,
        };

        return res.status(status).json(response);
      }

      // Các HttpException khác
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload?.message === 'string'
            ? payload.message
            : exception.message;

      const response: ApiErrorResponse = {
        success: false,
        code: payload?.code ?? 'HTTP_EXCEPTION',
        message,
        details: payload?.details,
        timestamp,
        path,
      };

      return res.status(status).json(response);
    }

    // 3) Unknown error -> 500 chuẩn
    const response: ApiErrorResponse = {
      success: false,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      timestamp,
      path,
    };

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
}
