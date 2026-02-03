import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

export const ExcelFileInterceptor = FileInterceptor('file', {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    // Check file extension
    if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
      return callback(new BadRequestException('Only Excel files (.xlsx, .xls) are allowed'), false);
    }

    // Check mime type
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream', // Sometimes Excel files come as octet-stream
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      return callback(new BadRequestException('Invalid file type'), false);
    }

    callback(null, true);
  },
});
