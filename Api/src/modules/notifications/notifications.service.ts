import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { EmailQueue } from '@entities/email_queue.entity';
import { EmailType } from '@common/enums/email_type';
import { EmailReferenceKind } from '@common/enums/email-reference-kind.enum';
import { EmailStatus } from '@common/enums/email_status';
import { LeaveRequest } from '@/entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@/entities/leave-request-notification-recipient.entity';


@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;
  private templates: Map<EmailType, Handlebars.TemplateDelegate> = new Map();

  constructor(
    @InjectRepository(EmailQueue)
    private emailQueueRepository: Repository<EmailQueue>,
  ) {
    this.initializeTransporter();
    this.loadTemplates();
  }

  /**
   * Try to send email immediately after enqueuing (fire and forget)
   * If fails, cronjob will retry later
   */
  private async trySendImmediately(emailId: number): Promise<void> {
    try {
      // Load email with user relation
      const email = await this.emailQueueRepository.findOne({
        where: { id: emailId, status: EmailStatus.PENDING },
        relations: ['recipientUser'],
      });

      if (!email) {
        this.logger.debug(`Email ${emailId} not found or already processed`);
        return;
      }

      // Update to PROCESSING (prevent cronjob from picking it up)
      email.status = EmailStatus.PROCESSING;
      email.processingStartedAt = new Date();
      email.workerId = 'immediate';
      await this.emailQueueRepository.save(email);

      this.logger.log(`⚡ Attempting immediate send for email ${emailId}`);

      // Try to send
      await this.sendEmail(email);

      // Mark as SENT
      await this.emailQueueRepository.update(emailId, {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        errorMessage: null,
      });

      this.logger.log(`✅ Email ${emailId} sent immediately`);
    } catch (error) {
      // Failed - revert to PENDING for cronjob retry
      const currentEmail = await this.emailQueueRepository.findOne({ where: { id: emailId } });
      const newAttemptCount = (currentEmail?.attemptCount || 0) + 1;
      // Faster retry: 30s, 1min, 2min, 4min, 8min
      const retryDelaySeconds = newAttemptCount === 1 ? 30 : Math.pow(2, newAttemptCount - 1) * 60;
      const nextRetryAt = new Date(Date.now() + retryDelaySeconds * 1000);

      await this.emailQueueRepository.update(emailId, {
        status: EmailStatus.PENDING,
        attemptCount: newAttemptCount + 1,
        nextRetryAt: nextRetryAt,
        errorMessage: error.message || 'Immediate send failed',
        processingStartedAt: null,
        workerId: null,
      });

      this.logger.warn(
        `⚠️ Immediate send failed for email ${emailId}: ${error.message}. ` +
          `Will retry at ${nextRetryAt.toISOString()}`,
      );
    }
  }

  /**
   * Clean up on module destroy
   */
  async onModuleDestroy() {
    if (this.transporter) {
      this.logger.log('🔌 Closing SMTP transporter connection pool...');
      this.transporter.close();
    }
  }

  /**
   * Initialize Zoho SMTP transporter
   */
  private async initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zoho.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // Use SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Connection pooling to prevent "Unexpected socket close" errors
      pool: true, // Enable connection pooling
      maxConnections: 3, // Reduce concurrent connections to avoid overwhelming server
      maxMessages: 50, // Reconnect more frequently to prevent stale connections
      rateDelta: 1000, // Rate limiting: time window (ms)
      rateLimit: 3, // Rate limiting: 3 emails per second (more conservative)
      // Timeout settings - increased for better reliability
      connectionTimeout: 120000, // 120 seconds (2 minutes)
      greetingTimeout: 60000, // 60 seconds
      socketTimeout: 120000, // 120 seconds (2 minutes)
      // Keep connection alive settings
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
      // Disable verbose logging
      logger: false,
      debug: false,
    });

    // Verify connection on startup
    try {
      await this.transporter.verify();
      this.logger.log('✅ Zoho SMTP transporter initialized and verified with connection pooling');
    } catch (error) {
      this.logger.error('❌ Failed to verify SMTP connection:', error.message);
      this.logger.warn('⚠️ Emails may fail to send. Please check SMTP credentials and connection.');
    }
  }

  /**
   * Load all email templates
   */
  private loadTemplates() {
    const templateDir = path.join(__dirname, 'mail-templates');
    this.logger.debug(`📁 Looking for templates in: ${templateDir}`);

    if (!fs.existsSync(templateDir)) {
      this.logger.error(`❌ Templates directory not found: ${templateDir}`);
      return;
    }

    const templateFiles = [
      { type: EmailType.ACTIVATION, file: 'activation.hbs' },
      { type: EmailType.LEAVE_REQUEST_SUBMITTED, file: 'leave-request-submitted.hbs' },
      { type: EmailType.LEAVE_REQUEST_APPROVED, file: 'leave-request-approved.hbs' },
      { type: EmailType.LEAVE_REQUEST_REJECTED, file: 'leave-request-rejected.hbs' },
      { type: EmailType.LEAVE_REQUEST_UPDATED, file: 'leave-request-updated.hbs' },
      { type: EmailType.LEAVE_REQUEST_CANCELLED, file: 'leave-request-cancelled.hbs' },
    ];

    for (const { type, file } of templateFiles) {
      const templatePath = path.join(templateDir, file);
      if (fs.existsSync(templatePath)) {
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        this.templates.set(type, Handlebars.compile(templateSource));
        this.logger.log(`✅ Loaded template: ${file} (key: ${type})`);
      } else {
        this.logger.error(`❌ Template file not found: ${templatePath}`);
      }
    }

    this.logger.log(`📧 Total templates loaded: ${this.templates.size}`);
    this.logger.debug(`📋 Template keys: ${Array.from(this.templates.keys()).join(', ')}`);
  }

  /**
   * Send email using SMTP (called by worker)
   * Includes retry logic for transient errors
   */
  async sendEmail(email: EmailQueue): Promise<void> {
    this.logger.debug(
      `🔍 Looking for template with key: "${email.type}" (type: ${typeof email.type})`,
    );
    this.logger.debug(`📋 Available keys: ${Array.from(this.templates.keys()).join(', ')}`);

    const template = this.templates.get(email.type);
    if (!template) {
      this.logger.error(
        `❌ Template not found! Requested: "${email.type}", Available: [${Array.from(this.templates.keys()).join(', ')}]`,
      );
      throw new Error(`Template not found for email type: ${email.type}`);
    }

    // Render HTML from template
    const html = template(email.context);

    // Get subject from context or use default
    const subject = this.getEmailSubject(email.type, email.context);

    this.logger.debug(`📤 Sending email ${email.id} to ${email.recipientUser.email} via SMTP...`);
    
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'SkyTimeHub'}" <${process.env.SMTP_USER}>`,
      to: email.recipientUser.email,
      subject,
      html,
    };

    // Retry logic for transient errors (timeout, connection reset)
    const maxRetries = 2;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(
          `✅ Email ${email.id} sent to ${email.recipientUser.email}: ${info.messageId}${attempt > 1 ? ` (attempt ${attempt})` : ''}`,
        );
        return; // Success - exit function
      } catch (error) {
        lastError = error;
        const isTimeout = error.message?.includes('Timeout') || error.code === 'ETIMEDOUT';
        const isConnectionError =
          error.message?.includes('ECONNRESET') || error.message?.includes('socket');

        if ((isTimeout || isConnectionError) && attempt < maxRetries) {
          this.logger.warn(
            `⚠️ Email ${email.id} attempt ${attempt} failed with ${error.message}, retrying...`,
          );
          // Wait 2 seconds before retry
          await new Promise((resolve) => setTimeout(resolve, 2000));
          
          // On timeout, verify and potentially recreate connection
          if (isTimeout) {
            try {
              await this.transporter.verify();
            } catch (verifyError) {
              this.logger.warn('⚠️ SMTP verification failed, reinitializing transporter...');
              await this.initializeTransporter();
            }
          }
          continue;
        }

        // Log final failure
        this.logger.error(
          `❌ Failed to send email ${email.id} to ${email.recipientUser.email} after ${attempt} attempt(s): ${error.message}`,
        );
        throw error;
      }
    }

    // Should not reach here, but just in case
    throw lastError;
  }

  /**
   * Get email subject based on type and context
   */
  private getEmailSubject(type: EmailType, context: any): string {
    switch (type) {
      case EmailType.ACTIVATION:
        return 'Kích hoạt tài khoản SkyTimeHub';
      case EmailType.LEAVE_REQUEST_SUBMITTED:
        return `Yêu cầu nghỉ phép mới từ ${context.requesterName || 'User'}`;
      case EmailType.LEAVE_REQUEST_APPROVED:
        return 'Yêu cầu nghỉ phép đã được phê duyệt';
      case EmailType.LEAVE_REQUEST_REJECTED:
        return 'Yêu cầu nghỉ phép bị từ chối';
      case EmailType.LEAVE_REQUEST_UPDATED:
        return `Yêu cầu nghỉ phép đã được cập nhật - ${context.requesterName || 'User'}`;
      case EmailType.LEAVE_REQUEST_CANCELLED:
        return `Yêu cầu nghỉ phép đã bị hủy - ${context.requesterName || 'User'}`;
      default:
        return 'Thông báo từ SkyTimeHub';
    }
  }

  /**
   * Enqueue activation email
   */
  async enqueueActivationEmail(
    userId: number,
    activationToken: string,
    activationLink: string,
  ): Promise<void> {
    const idempotencyKey = `activation-${userId}-${activationToken}`;

    // Check if already exists
    const existing = await this.emailQueueRepository.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.debug(`Activation email already queued for user ${userId}`);
      return;
    }

    // Create new email queue entry
    const emailQueue = this.emailQueueRepository.create({
      recipientUserId: userId,
      type: EmailType.ACTIVATION,
      referenceKind: EmailReferenceKind.INVITE,
      referenceId: userId,
      idempotencyKey: idempotencyKey,
      context: {
        activationLink,
        activationToken,
      },
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await this.emailQueueRepository.save(emailQueue);
    this.logger.log(`✅ Activation email queued for user ${userId}`);
    
    // Try to send immediately (fire and forget)
    setImmediate(() => this.trySendImmediately(savedEmail.id));
  }

  /**
   * Enqueue leave request notification (for approver + HR/CC)
   */
  async enqueueLeaveRequestNotification(
    leaveRequestId: number,
    recipientUserId: number,
    context: {
      requesterName: string;
      approverName: string;
      startDate: string;
      endDate: string;
      leaveRequestId: number;
      dashboardLink: string;
    },
  ): Promise<void> {
    const idempotencyKey = `leave-req-${leaveRequestId}-${recipientUserId}`;

    const existing = await this.emailQueueRepository.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.debug(
        `Leave request notification already queued for request ${leaveRequestId}, user ${recipientUserId}`,
      );
      return;
    }

    const emailQueue = this.emailQueueRepository.create({
      recipientUserId,
      type: EmailType.LEAVE_REQUEST_SUBMITTED,
      referenceKind: EmailReferenceKind.LEAVE_REQUEST,
      referenceId: leaveRequestId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await this.emailQueueRepository.save(emailQueue);
    this.logger.log(
      `✅ Leave request notification queued for request ${leaveRequestId}, user ${recipientUserId}`,
    );
    
    // Try to send immediately (fire and forget)
    setImmediate(() => this.trySendImmediately(savedEmail.id));
  }

  /**
   * Enqueue leave request approved notification
   */
  async enqueueLeaveRequestApprovedNotification(
    leaveRequestId: number,
    recipientUserId: number,
    recipients: LeaveRequestNotificationRecipient[],
    context: {
      requesterName: string;
      approverName: string;
      startDate: string;
      endDate: string;
      approvedAt: string;
      dashboardLink: string;
    },
  ): Promise<void> {
    const idempotencyKey = `leave-approved-${leaveRequestId}-${recipientUserId}`;

    const existing = await this.emailQueueRepository.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return;
    }

    const emailQueue = this.emailQueueRepository.create({
      recipientUserId: recipientUserId,
      type: EmailType.LEAVE_REQUEST_APPROVED,
      referenceKind: EmailReferenceKind.LEAVE_REQUEST,
      referenceId: leaveRequestId,
      idempotencyKey: idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await this.emailQueueRepository.save(emailQueue);

    // Try to send immediately (fire and forget)
    setImmediate(() => this.trySendImmediately(savedEmail.id));

    for(const recipient of recipients) {
      if(recipient.userId !== recipientUserId) {
        await this.enqueueLeaveRequestApprovedNotification(
          leaveRequestId,
          recipient.userId,
          recipients,
          context,
        );
      }
    }
    this.logger.log(`✅ Leave request approved notification queued for request ${leaveRequestId}`);
  }

  /**
   * Enqueue leave request rejected notification
   */
  async enqueueLeaveRequestRejectedNotification(
    leaveRequestId: number,
    recipientUserId: number,
    context: {
      requesterName: string;
      approverName: string;
      startDate: string;
      endDate: string;
      rejectedAt: string;
      rejectedReason: string;
      dashboardLink: string;
    },
  ): Promise<void> {
    const idempotencyKey = `leave-rejected-${leaveRequestId}-${recipientUserId}`;

    const existing = await this.emailQueueRepository.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return;
    }

    const emailQueue = this.emailQueueRepository.create({
      recipientUserId: recipientUserId,
      type: EmailType.LEAVE_REQUEST_REJECTED,
      referenceKind: EmailReferenceKind.LEAVE_REQUEST,
      referenceId: leaveRequestId,
      idempotencyKey: idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await this.emailQueueRepository.save(emailQueue);
    this.logger.log(`✅ Leave request rejected notification queued for request ${leaveRequestId}`);
    
    // Try to send immediately (fire and forget)
    setImmediate(() => this.trySendImmediately(savedEmail.id));
  }

  /**
   * Enqueue leave request updated notification
   */
  async enqueueLeaveRequestUpdatedNotification(
    leaveRequestId: number,
    recipientUserId: number,
    context: {
      requesterName: string;
      startDate: string;
      endDate: string;
      dashboardLink: string;
    },
  ): Promise<void> {
    const idempotencyKey = `leave-updated-${leaveRequestId}-${recipientUserId}-${Date.now()}`;

    const emailQueue = this.emailQueueRepository.create({
      recipientUserId: recipientUserId,
      type: EmailType.LEAVE_REQUEST_UPDATED,
      referenceKind: EmailReferenceKind.LEAVE_REQUEST,
      referenceId: leaveRequestId,
      idempotencyKey: idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await this.emailQueueRepository.save(emailQueue);
    this.logger.log(`✅ Leave request updated notification queued for request ${leaveRequestId}`);
    
    // Try to send immediately (fire and forget)
    setImmediate(() => this.trySendImmediately(savedEmail.id));
  }

  /**
   * Enqueue leave request cancelled notification
   */
  async enqueueLeaveRequestCancelledNotification(
    leaveRequestId: number,
    recipientUserId: number,
    context: {
      requesterName: string;
      startDate: string;
      endDate: string;
      cancelledAt: string;
      dashboardLink: string;
    },
  ): Promise<void> {
    const idempotencyKey = `leave-cancelled-${leaveRequestId}-${recipientUserId}-${Date.now()}`;

    const emailQueue = this.emailQueueRepository.create({
      recipientUserId: recipientUserId,
      type: EmailType.LEAVE_REQUEST_CANCELLED,
      referenceKind: EmailReferenceKind.LEAVE_REQUEST,
      referenceId: leaveRequestId,
      idempotencyKey: idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await this.emailQueueRepository.save(emailQueue);
    this.logger.log(`✅ Leave request cancelled notification queued for request ${leaveRequestId}`);
    
    // Try to send immediately (fire and forget)
    setImmediate(() => this.trySendImmediately(savedEmail.id));
  }
}
