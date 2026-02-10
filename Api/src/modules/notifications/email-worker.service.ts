import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { EmailQueue } from '@entities/email_queue.entity';
import { EmailStatus } from '@common/enums/email_status';
import { NotificationsService } from './notifications.service';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailWorkerService {
  private readonly logger = new Logger(EmailWorkerService.name);
  private readonly workerId: string;
  private readonly PROCESSING_TIMEOUT_MINUTES: number;
  private readonly BATCH_SIZE: number;

  constructor(
    @InjectRepository(EmailQueue)
    private emailQueueRepository: Repository<EmailQueue>,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    // Set timeout with default value and validation
    const timeoutConfig = this.configService.get('PROCESSING_TIMEOUT_MINUTES');
    this.PROCESSING_TIMEOUT_MINUTES = Number(timeoutConfig) || 10; // Default: 10 minutes

    if (!timeoutConfig || isNaN(Number(timeoutConfig))) {
      this.logger.warn(
        `PROCESSING_TIMEOUT_MINUTES not set or invalid (${timeoutConfig}), using default: ${this.PROCESSING_TIMEOUT_MINUTES} minutes`,
      );
    }

    const batchConfig = this.configService.get('BATCH_SIZE');
    this.BATCH_SIZE = Number(batchConfig) || 10; // Default: 10 emails

    if (!batchConfig || isNaN(Number(batchConfig))) {
      this.logger.warn(
        `BATCH_SIZE not set or invalid (${batchConfig}), using default: ${this.BATCH_SIZE}`,
      );
    }

    // Generate unique worker ID
    this.workerId = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    this.logger.log(
      `Email Worker initialized with ID: ${this.workerId}, ` +
        `Timeout: ${this.PROCESSING_TIMEOUT_MINUTES} minutes, ` +
        `Batch size: ${this.BATCH_SIZE}`,
    );
  }

  /**
   * Main cron job - runs every minute to process pending emails
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processEmailQueue() {
    this.logger.debug('Starting email queue processing...');

    try {
      // Step 1: Clean up stale processing emails (timeout recovery)
      await this.recoverStalledEmails();

      // Step 2: Pick and process pending emails
      const emails = await this.pickPendingEmails();

      if (emails.length === 0) {
        // Check if there are pending emails scheduled for later
        const scheduledCount = await this.emailQueueRepository.count({
          where: {
            status: EmailStatus.PENDING,
          },
        });

        if (scheduledCount > 0) {
          this.logger.debug(
            `No emails ready to process (${scheduledCount} pending, scheduled for retry)`,
          );
        } else {
          this.logger.debug('No pending emails to process');
        }
        return;
      }

      this.logger.log(`Processing ${emails.length} emails`);

      // Process emails in parallel (but limit concurrency)
      const results = await Promise.allSettled(emails.map((email) => this.processEmail(email)));

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(`Email processing completed: ${succeeded} succeeded, ${failed} failed`);
    } catch (error) {
      this.logger.error('Error in email queue processing', error.stack);
    }
  }

  /**
   * Recover emails stuck in PROCESSING state (e.g., worker crashed)
   */
  private async recoverStalledEmails() {
    const timeoutThreshold = new Date(Date.now() - this.PROCESSING_TIMEOUT_MINUTES * 60 * 1000);

    // First check all PROCESSING emails for debugging
    const allProcessing = await this.emailQueueRepository.find({
      where: { status: EmailStatus.PROCESSING },
    });

    if (allProcessing.length > 0) {
      this.logger.debug(
        `Found ${allProcessing.length} PROCESSING emails. Details: ${JSON.stringify(
          allProcessing.map((e) => ({
            id: e.id,
            workerId: e.workerId,
            processingStartedAt: e.processingStartedAt,
            currentWorkerId: this.workerId,
            isOld: e.processingStartedAt && e.processingStartedAt < timeoutThreshold,
          })),
        )}`,
      );
    }

    const stalledEmails = await this.emailQueueRepository
      .createQueryBuilder('email')
      .where('email.status = :status', { status: EmailStatus.PROCESSING })
      .andWhere(
        new Brackets((qb) => {
          qb.where('email.processingStartedAt < :threshold', {
            threshold: timeoutThreshold,
          }).orWhere('email.processingStartedAt IS NULL');
        }),
      )
      .take(this.BATCH_SIZE)
      .getMany();

    if (stalledEmails.length > 0) {
      this.logger.warn(`Found ${stalledEmails.length} stalled emails, recovering...`);

      for (const email of stalledEmails) {
        const oldWorkerId = email.workerId;
        email.status = EmailStatus.PENDING;
        email.processingStartedAt = null;
        email.workerId = null;
        email.errorMessage = `Recovered from stalled processing by ${oldWorkerId || 'unknown worker'}`;
        await this.emailQueueRepository.save(email);
        this.logger.log(`Recovered email ${email.id}`);
      }
    }
  }

  /**
   * Pick pending emails ready to be sent
   */
  private async pickPendingEmails(): Promise<EmailQueue[]> {
    const now = new Date();
    const qr = this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    try {
      this.logger.debug(
        `🔍 Looking for PENDING emails ready to process (next_retry_at <= ${now.toISOString()})`,
      );

      // Step 1: SELECT with FOR UPDATE SKIP LOCKED to atomically lock pending rows
      const pendingRows: { id: number }[] = await qr.query(
        `
        SELECT id
        FROM email_queue
        WHERE status = $1
          AND next_retry_at <= $2
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $3
        `,
        [EmailStatus.PENDING, now, this.BATCH_SIZE],
      );

      const ids = (Array.isArray(pendingRows) ? pendingRows : [])
        .map((r) => r.id)
        .filter((id) => id != null);

      if (ids.length === 0) {
        this.logger.debug('No PENDING emails found ready for processing');
        await qr.commitTransaction();
        return [];
      }

      // Step 2: Claim the locked rows by updating their status
      const claimedAt = new Date();
      await qr.query(
        `
        UPDATE email_queue
        SET status = $1,
            processing_started_at = $2,
            worker_id = $3
        WHERE id = ANY($4)
        `,
        [EmailStatus.PROCESSING, claimedAt, this.workerId, ids],
      );

      this.logger.log(
        `✅ Claimed ${ids.length} emails (PENDING → PROCESSING). ` +
          `IDs: [${ids.join(', ')}], ` +
          `Worker: ${this.workerId}, ` +
          `Processing started at: ${claimedAt.toISOString()}`,
      );

      // Step 3: Load full entities with relations
      const claimed = await qr.manager
        .getRepository(EmailQueue)
        .createQueryBuilder('email')
        .leftJoinAndSelect('email.recipientUser', 'user')
        .where('email.id IN (:...ids)', { ids })
        .getMany();

      await qr.commitTransaction();
      return claimed;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /**
   * Process a single email
   */
  private async processEmail(email: EmailQueue): Promise<void> {
    this.logger.log(
      `📧 Processing email ${email.id} (${email.type}). ` +
        `Current status: ${email.status}, ` +
        `Worker: ${email.workerId}, ` +
        `Attempt: ${email.attemptCount + 1}/${email.maxAttempts}, ` +
        `Processing started at: ${email.processingStartedAt?.toISOString()}`,
    );

    try {
      // Send email via NotificationsService
      await this.notificationsService.sendEmail(email);

      // Mark as SENT
      await this.emailQueueRepository.update(email.id, {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      });

      this.logger.log(`✅ Email ${email.id} sent successfully (PROCESSING → SENT)`);
    } catch (error) {
      this.logger.error(`❌ Failed to send email ${email.id}: ${error.message}`, error.stack);

      await this.handleEmailFailure(email, error);
    }
  }

  /**
   * Handle email sending failure with retry logic
   */
  private async handleEmailFailure(email: EmailQueue, error: any) {
    const newAttemptCount = email.attemptCount + 1;
    const isMaxAttemptsReached = newAttemptCount >= email.maxAttempts;

    if (isMaxAttemptsReached) {
      // Mark as FAILED permanently
      await this.emailQueueRepository.update(email.id, {
        status: EmailStatus.FAILED,
        failedAt: new Date(),
        attemptCount: newAttemptCount,
        errorMessage: error.message || 'Unknown error',
      });

      this.logger.error(`Email ${email.id} permanently failed after ${newAttemptCount} attempts`);
    } else {
      // Schedule retry with exponential backoff
      const retryDelayMinutes = Math.pow(2, newAttemptCount); // 2, 4, 8 minutes
      const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

      await this.emailQueueRepository.update(email.id, {
        status: EmailStatus.PENDING,
        attemptCount: newAttemptCount,
        nextRetryAt: nextRetryAt,
        errorMessage: error.message || 'Unknown error',
        processingStartedAt: null,
        workerId: null,
      });

      this.logger.warn(
        `⚠️ Email ${email.id} retry scheduled (PROCESSING → PENDING). ` +
          `Next retry at: ${nextRetryAt.toISOString()}, ` +
          `Attempt: ${newAttemptCount}/${email.maxAttempts}, ` +
          `Error: ${error.message}`,
      );
    }
  }

  /**
   * Health check - logs queue statistics
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async logQueueStats() {
    try {
      const stats = await this.emailQueueRepository
        .createQueryBuilder('email')
        .select('email.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('email.status')
        .getRawMany();

      this.logger.log(`📊 Email Queue Stats: ${JSON.stringify(stats)}`);
    } catch (error) {
      this.logger.error('Error fetching queue stats', error.stack);
    }
  }
}
