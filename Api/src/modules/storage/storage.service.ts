import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private bucket: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'files');
    this.s3 = new S3Client({
      endpoint: this.config.get<string>('MINIO_ENDPOINT', 'http://localhost:9000'),
      region: this.config.get<string>('MINIO_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY', 'admin'),
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY', 'admin123'),
      },
      forcePathStyle: true, // required for MinIO
    });
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<{ objectKey: string; bucket: string }> {
    const safeFilename = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `attachments/${randomUUID()}/${safeFilename}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
        ContentDisposition: `inline; filename="${safeFilename}"`,
      }),
    );

    this.logger.log(`Uploaded file to MinIO: ${objectKey}`);
    return { objectKey, bucket: this.bucket };
  }

  async getPresignedUrl(objectKey: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn },
    );
  }

  getBucket(): string {
    return this.bucket;
  }
}
