// src/common/errors/app.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/errror-code.enum';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
