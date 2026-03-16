import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { EmailQueue } from '@entities/email_queue.entity';
import { EmailType } from '@common/enums/email_type';
import { EmailReferenceKind } from '@common/enums/email-reference-kind.enum';
import { EmailStatus } from '@common/enums/email_status';
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
   * Fire-and-forget: trigger immediate send for a list of email IDs.
   * Call this AFTER the transaction that inserted the emails has committed.
   */
  triggerImmediateSend(emailIds: number[]): void {
    for (const id of emailIds) {
      setImmediate(() => this.trySendImmediately(id));
    }
  }

  /**
   * Try to send email immediately after enqueuing (fire and forget)
   * If fails, cronjob will retry later
   */
  async trySendImmediately(emailId: number): Promise<void> {
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
      { type: EmailType.OT_PLAN_SUBMITTED, file: 'ot-plan-submitted.hbs' },
      { type: EmailType.OT_PLAN_APPROVED, file: 'ot-plan-approved.hbs' },
      { type: EmailType.OT_PLAN_REJECTED, file: 'ot-plan-rejected.hbs' },
      { type: EmailType.OT_PLAN_CANCELLED, file: 'ot-plan-cancelled.hbs' },
      { type: EmailType.OT_ASSIGNMENT_APPROVED, file: 'ot-assignment-approved.hbs' },
      { type: EmailType.OT_ASSIGNMENT_CANCELLED, file: 'ot-assignment-cancelled.hbs' },
      { type: EmailType.OT_CHECKIN_CONFIRMED, file: 'ot-checkin-confirmed.hbs' },
      { type: EmailType.OT_CHECKIN_REJECTED, file: 'ot-checkin-rejected.hbs' },
      { type: EmailType.OT_CHECKOUT_SUBMITTED, file: 'ot-checkout-submitted.hbs' },
      { type: EmailType.OT_AUTO_CHECKOUT, file: 'ot-auto-checkout.hbs' },
      { type: EmailType.NONE, file: 'none.hbs' },
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
    let lastError: Error = new Error('Unknown error');

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
  private getEmailSubject(type: EmailType, context: Record<string, unknown>): string {
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
      case EmailType.OT_PLAN_SUBMITTED:
        return `[Action Required] OT Plan – ${context.departmentName || ''}`;
      case EmailType.OT_PLAN_APPROVED:
        return '[Approved] Your department OT plan';
      case EmailType.OT_ASSIGNMENT_APPROVED:
        return '[Approved] Your OT Assignment';
      case EmailType.OT_PLAN_REJECTED:
        return '[Rejected] Your OT Plan';
      case EmailType.OT_PLAN_CANCELLED:
        return `[Notice] OT plan canceled – ${context.departmentName || ''}`;
      case EmailType.OT_ASSIGNMENT_CANCELLED:
        return '[Notice] Your OT assignment canceled';
      case EmailType.OT_CHECKIN_REJECTED:
        return '[Rejected] Your actual OT hours';
      case EmailType.OT_CHECKIN_CONFIRMED:
        return '[Confirmed] Your actual OT hours';
      case EmailType.OT_CHECKOUT_SUBMITTED:
        return `[Action Required] Overtime Confirmation – ${context.employeeName || ''}`;
      case EmailType.OT_AUTO_CHECKOUT:
        return '[System Alert] Automatic OT Check-out Recorded';
      case EmailType.NONE:
        return 'Thông báo từ SkyTimeHub';

      default:
        return 'Thông báo từ SkyTimeHub';
    }
  }

  /**
   * Get the timestamp of the last activation email sent/queued for a user
   * Used for rate limiting resend requests
   */
  async getLastActivationEmailTime(userId: number): Promise<Date | null> {
    const lastEmail = await this.emailQueueRepository.findOne({
      where: {
        recipientUserId: userId,
        type: EmailType.ACTIVATION,
      },
      order: { createdAt: 'DESC' },
    });
    return lastEmail?.createdAt || null;
  }

  /**
   * Enqueue activation email.
   * @param manager - If provided, uses this EntityManager (inside a transaction).
   *                  Caller is responsible for calling triggerImmediateSend() after commit.
   *                  If omitted, saves directly and fires immediate send.
   * @returns array of queued email IDs
   */
  async enqueueActivationEmail(
    userId: number,
    activationToken: string,
    activationLink: string,
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;

    const idempotencyKey = `activation-${userId}-${activationToken}`;

    // Check if already exists
    const existing = await repo.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.debug(`Activation email already queued for user ${userId}`);
      return [];
    }

    // Create new email queue entry
    const emailQueue = repo.create({
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

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(`✅ Activation email queued for user ${userId}`);

    if (!manager) {
      // No transaction context — fire immediate send directly
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue leave request notification (for approver + HR/CC).
   * @param manager - If provided, uses this EntityManager (inside a transaction).
   * @returns array of queued email IDs
   */
  async enqueueLeaveRequestCreatedNotification(
    leaveRequestId: number,
    recipientUserId: number,
    recipients: LeaveRequestNotificationRecipient[],
    context: {
      requesterName: string;
      approverName: string;
      startDate: string;
      endDate: string;
      leaveRequestId: number;
      dashboardLink: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;

    const idempotencyKey = `leave-req-${leaveRequestId}-${recipientUserId}`;

    const existing = await repo.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.debug(
        `Leave request notification already queued for request ${leaveRequestId}, user ${recipientUserId}`,
      );
      return [];
    }

    const emailQueue = repo.create({
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

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(
      `✅ Leave request notification queued for request ${leaveRequestId}, user ${recipientUserId}`,
    );

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue leave request approved notification.
   * @param manager - If provided, uses this EntityManager (inside a transaction).
   * @returns array of queued email IDs
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
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;

    const idempotencyKey = `leave-approved-${leaveRequestId}-${recipientUserId}`;

    const existing = await repo.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return [];
    }

    const emailQueue = repo.create({
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

    const savedEmail = await repo.save(emailQueue);
    const emailIds: number[] = [savedEmail.id];

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    for (const recipient of recipients) {
      if (recipient.userId !== recipientUserId) {
        const childIds = await this.enqueueLeaveRequestApprovedNotification(
          leaveRequestId,
          recipient.userId,
          recipients,
          context,
          manager,
        );
        emailIds.push(...childIds);
      }
    }
    this.logger.log(`✅ Leave request approved notification queued for request ${leaveRequestId}`);
    return emailIds;
  }

  /**
   * Enqueue leave request rejected notification (requester + recipients).
   * @param manager - If provided, uses this EntityManager (inside a transaction).
   * @returns array of queued email IDs
   */
  async enqueueLeaveRequestRejectedNotification(
    leaveRequestId: number,
    recipientUserId: number,
    recipients: LeaveRequestNotificationRecipient[],
    context: {
      requesterName: string;
      approverName: string;
      startDate: string;
      endDate: string;
      rejectedAt: string;
      rejectedReason: string;
      dashboardLink: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;

    const idempotencyKey = `leave-rejected-${leaveRequestId}-${recipientUserId}`;

    const existing = await repo.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return [];
    }

    const emailQueue = repo.create({
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

    const savedEmail = await repo.save(emailQueue);
    const emailIds: number[] = [savedEmail.id];

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    // Also notify recipients (HR, CC)
    for (const recipient of recipients) {
      if (recipient.userId !== recipientUserId) {
        const childIds = await this.enqueueLeaveRequestRejectedNotification(
          leaveRequestId,
          recipient.userId,
          recipients,
          context,
          manager,
        );
        emailIds.push(...childIds);
      }
    }
    this.logger.log(`✅ Leave request rejected notification queued for request ${leaveRequestId}`);
    return emailIds;
  }

  /**
   * Enqueue leave request updated notification (approver + recipients).
   * @param manager - If provided, uses this EntityManager (inside a transaction).
   * @returns array of queued email IDs
   */
  async enqueueLeaveRequestUpdatedNotification(
    leaveRequestId: number,
    recipientUserId: number,
    recipients: LeaveRequestNotificationRecipient[],
    context: {
      requesterName: string;
      startDate: string;
      endDate: string;
      dashboardLink: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;

    const idempotencyKey = `leave-updated-${leaveRequestId}-${recipientUserId}-${Date.now()}`;

    const emailQueue = repo.create({
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

    const savedEmail = await repo.save(emailQueue);
    const emailIds: number[] = [savedEmail.id];

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    // Also notify recipients (HR, CC)
    for (const recipient of recipients) {
      if (recipient.userId !== recipientUserId) {
        const childIds = await this.enqueueLeaveRequestUpdatedNotification(
          leaveRequestId,
          recipient.userId,
          recipients,
          context,
          manager,
        );
        emailIds.push(...childIds);
      }
    }
    this.logger.log(`✅ Leave request updated notification queued for request ${leaveRequestId}`);
    return emailIds;
  }

  /**
   * Enqueue leave request cancelled notification (requester + recipients).
   * @param manager - If provided, uses this EntityManager (inside a transaction).
   * @returns array of queued email IDs
   */
  async enqueueLeaveRequestCancelledNotification(
    leaveRequestId: number,
    recipientUserId: number,
    recipients: LeaveRequestNotificationRecipient[],
    context: {
      requesterName: string;
      startDate: string;
      endDate: string;
      cancelledAt: string;
      dashboardLink: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;

    const idempotencyKey = `leave-cancelled-${leaveRequestId}-${recipientUserId}-${Date.now()}`;

    const emailQueue = repo.create({
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

    const savedEmail = await repo.save(emailQueue);
    const emailIds: number[] = [savedEmail.id];

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    // Also notify recipients (HR, CC)
    for (const recipient of recipients) {
      if (recipient.userId !== recipientUserId) {
        const childIds = await this.enqueueLeaveRequestCancelledNotification(
          leaveRequestId,
          recipient.userId,
          recipients,
          context,
          manager,
        );
        emailIds.push(...childIds);
      }
    }
    this.logger.log(`✅ Leave request cancelled notification queued for request ${leaveRequestId}`);
    return emailIds;
  }

  // ─── OT PLAN NOTIFICATIONS ──────────────────────────────────

  /**
   * Enqueue OT plan submitted notification to BOD.
   */
  async enqueueOtPlanSubmittedNotification(
    otPlanId: number,
    bodUserId: number,
    context: {
      bodName: string;
      leaderName: string;
      departmentName: string;
      otPlanUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-plan-submitted-${otPlanId}-${bodUserId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: bodUserId,
      type: EmailType.OT_PLAN_SUBMITTED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: otPlanId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(`✅ OT plan submitted notification queued for plan ${otPlanId}`);

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT plan approved notification to Department Leader.
   */
  async enqueueOtPlanApprovedNotification(
    otPlanId: number,
    leaderUserId: number,
    context: {
      leaderName: string;
      departmentName: string;
      approverName: string;
      approvedAt: string;
      otPlanUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-plan-approved-${otPlanId}-${leaderUserId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: leaderUserId,
      type: EmailType.OT_PLAN_APPROVED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: otPlanId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(`✅ OT plan approved notification queued for plan ${otPlanId}`);

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT assignment approved notification to a single Employee.
   */
  async enqueueOtAssignmentApprovedNotification(
    otPlanId: number,
    employeeId: number,
    context: {
      employeeName: string;
      otAssignmentUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-assignment-approved-${otPlanId}-${employeeId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: employeeId,
      type: EmailType.OT_ASSIGNMENT_APPROVED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: otPlanId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(
      `✅ OT assignment approved notification queued for plan ${otPlanId}, employee ${employeeId}`,
    );

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT plan rejected notification to Department Leader.
   */
  async enqueueOtPlanRejectedNotification(
    otPlanId: number,
    leaderUserId: number,
    context: {
      leaderName: string;
      departmentName: string;
      approverName: string;
      rejectedReason: string;
      rejectedAt: string;
      otPlanUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-plan-rejected-${otPlanId}-${leaderUserId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: leaderUserId,
      type: EmailType.OT_PLAN_REJECTED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: otPlanId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(`✅ OT plan rejected notification queued for plan ${otPlanId}`);

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT plan cancelled notification to BOD.
   */
  async enqueueOtPlanCancelledNotification(
    otPlanId: number,
    bodUserId: number,
    context: {
      bodName: string;
      leaderName: string;
      departmentName: string;
      otPlanUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-plan-cancelled-${otPlanId}-${bodUserId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: bodUserId,
      type: EmailType.OT_PLAN_CANCELLED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: otPlanId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(`✅ OT plan cancelled notification queued for plan ${otPlanId}`);

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT assignment cancelled notification to a single Employee.
   * Only sent when the cancelled plan was previously Approved.
   */
  async enqueueOtAssignmentCancelledNotification(
    otPlanId: number,
    employeeId: number,
    context: {
      employeeName: string;
      otAssignmentUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-assignment-cancelled-${otPlanId}-${employeeId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: employeeId,
      type: EmailType.OT_ASSIGNMENT_CANCELLED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: otPlanId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(
      `✅ OT assignment cancelled notification queued for plan ${otPlanId}, employee ${employeeId}`,
    );

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT check-in confirmed notification to Employee.
   */
  async enqueueOtCheckinConfirmedNotification(
    checkinId: number,
    employeeId: number,
    context: {
      employeeName: string;
      planTitle: string;
      confirmedBy: string;
      otDate: string;
      confirmedAt: string;
      otPlanUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-checkin-confirmed-${checkinId}-${employeeId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: employeeId,
      type: EmailType.OT_CHECKIN_CONFIRMED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: checkinId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(
      `✅ OT checkin confirmed notification queued for checkin ${checkinId}, employee ${employeeId}`,
    );

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT check-in rejected notification to Employee.
   */
  async enqueueOtCheckinRejectedNotification(
    checkinId: number,
    employeeId: number,
    context: {
      employeeName: string;
      planTitle: string;
      rejectedBy: string;
      otDate: string;
      rejectedAt: string;
      rejectedReason?: string;
      otPlanUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-checkin-rejected-${checkinId}-${employeeId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: employeeId,
      type: EmailType.OT_CHECKIN_REJECTED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: checkinId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(
      `✅ OT checkin rejected notification queued for checkin ${checkinId}, employee ${employeeId}`,
    );

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT checkout submitted notification to department leader (Approver).
   * Triggered after employee manually checks out.
   */
  async enqueueOtCheckoutSubmittedNotification(
    checkinId: number,
    leaderId: number,
    context: {
      employeeName: string;
      planTitle: string;
      checkInAt: string;
      checkOutAt: string;
      actualDuration: string;
      workOutput: string;
      otAssignmentUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-checkout-submitted-${checkinId}-${leaderId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: leaderId,
      type: EmailType.OT_CHECKOUT_SUBMITTED,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: checkinId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(
      `✅ OT checkout submitted notification queued for checkin ${checkinId}, leader ${leaderId}`,
    );

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }

  /**
   * Enqueue OT auto-checkout notification to Employee.
   * Triggered when the system auto-checks out an employee.
   */
  async enqueueOtAutoCheckoutNotification(
    checkinId: number,
    employeeId: number,
    context: {
      employeeName: string;
      planTitle: string;
      checkInAt: string;
      checkOutAt: string;
      actualDuration: string;
      otAssignmentUrl: string;
    },
    manager?: EntityManager,
  ): Promise<number[]> {
    const repo = manager ? manager.getRepository(EmailQueue) : this.emailQueueRepository;
    const idempotencyKey = `ot-auto-checkout-${checkinId}-${employeeId}`;

    const existing = await repo.findOne({ where: { idempotencyKey } });
    if (existing) return [];

    const emailQueue = repo.create({
      recipientUserId: employeeId,
      type: EmailType.OT_AUTO_CHECKOUT,
      referenceKind: EmailReferenceKind.OT_REQUEST,
      referenceId: checkinId,
      idempotencyKey,
      context,
      status: EmailStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(),
    });

    const savedEmail = await repo.save(emailQueue);
    this.logger.log(
      `✅ OT auto-checkout notification queued for checkin ${checkinId}, employee ${employeeId}`,
    );

    if (!manager) {
      setImmediate(() => this.trySendImmediately(savedEmail.id));
    }

    return [savedEmail.id];
  }
}
