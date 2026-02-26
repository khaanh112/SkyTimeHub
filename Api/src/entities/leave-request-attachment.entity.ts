import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequest } from './leave_request.entity';
import { User } from './users.entity';

@Entity('leave_request_attachments')
export class LeaveRequestAttachment {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'leave_request_id', type: 'int' })
  leaveRequestId: number;

  @ManyToOne(() => LeaveRequest, (lr) => lr.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_request_id' })
  leaveRequest: LeaveRequest;

  @ApiPropertyOptional({ example: 'medical_cert.pdf' })
  @Column({ name: 'original_filename', type: 'varchar', length: 255, nullable: true })
  originalFilename: string | null;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @Column({ name: 'content_type', type: 'varchar', length: 100, default: 'application/pdf' })
  contentType: string;

  @ApiPropertyOptional({ example: 102400 })
  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: number | null;

  @ApiProperty({ example: 'S3', description: 'Storage provider (S3 | MINIO)' })
  @Column({ name: 'storage_provider', type: 'varchar', length: 30 })
  storageProvider: string;

  @ApiPropertyOptional({ example: 'skytimehub-attachments' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  bucket: string | null;

  @ApiProperty({ description: 'Object key / path in storage' })
  @Column({ name: 'object_key', type: 'text' })
  objectKey: string;

  @ApiPropertyOptional({ description: 'User who uploaded' })
  @Column({ name: 'uploaded_by', type: 'int', nullable: true })
  uploadedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
