// Email Queue Entity - DB Polling Worker Pattern
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from './users.entity';
import { EmailType } from '@common/enums/email_type';
import { EmailStatus } from '@common/enums/email_status';
import { EmailReferenceKind } from '@common/enums/email-reference-kind.enum';

@Entity('email_queue')
@Index('idx_email_status_retry', ['status', 'nextRetryAt'])
@Index('idx_email_processing_timeout', ['status', 'processingStartedAt'])
@Index('idx_email_pick_order', ['status', 'createdAt'])
@Index('idx_email_recipient', ['recipientUserId'])
export class EmailQueue {
  @PrimaryGeneratedColumn()
  id: number;

  // Recipient (bắt buộc)
  @Column({ name: 'recipient_user_id', type: 'int', nullable: false })
  recipientUserId: number;

  @Exclude()
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipientUser: User;

  // Email type
  @Column({ type: 'enum', enum: EmailType, nullable: false })
  type: EmailType;

  // Reference tracking (optional)
  @Column({
    name: 'reference_kind',
    type: 'enum',
    enum: EmailReferenceKind,
    default: EmailReferenceKind.NONE,
  })
  referenceKind: EmailReferenceKind;

  @Column({ name: 'reference_id', type: 'int', nullable: true })
  referenceId: number | null;

  // Idempotency (unique constraint)
  @Column({ name: 'idempotency_key', unique: true, nullable: false })
  idempotencyKey: string;

  // Email content (context for template rendering)
  @Column({ type: 'jsonb', nullable: false })
  context: Record<string, any>;

  // Status workflow
  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.PENDING })
  status: EmailStatus;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', default: 5 })
  maxAttempts: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  nextRetryAt: Date;

  // Worker tracking
  @Column({ name: 'processing_started_at', type: 'timestamptz', nullable: true })
  processingStartedAt: Date | null;

  @Column({ name: 'worker_id', nullable: true })
  workerId: string | null;

  // Completion timestamps
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'skipped_at', type: 'timestamptz', nullable: true })
  skippedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
