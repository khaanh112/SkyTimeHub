import { HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/errror-code.enum';

export const ExcelFileInterceptor = FileInterceptor('file', {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    // Check file extension
    if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
      return callback(
        new AppException(
          ErrorCode.INVALID_INPUT,
          'Only xlsx file accepted',
          HttpStatus.BAD_REQUEST,
        ),
        false,
      );
    }

    // Check mime type
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream', // Sometimes Excel files come as octet-stream
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      return callback(
        new AppException(
          ErrorCode.INVALID_INPUT,
          'Only xlsx file accepted',
          HttpStatus.BAD_REQUEST,
        ),
        false,
      );
    }

    callback(null, true);
  },
});
