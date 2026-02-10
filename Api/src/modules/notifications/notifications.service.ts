import { Injectable, Logger } from '@nestjs/common';
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
import * as crypto from 'crypto';

@Injectable()
export class NotificationsService {
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
   * Initialize Zoho SMTP transporter
   */
  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zoho.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // Use SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.logger.log('✅ Zoho SMTP transporter initialized');
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
   */
  async sendEmail(email: EmailQueue): Promise<void> {
    this.logger.debug(`🔍 Looking for template with key: "${email.type}" (type: ${typeof email.type})`);
    this.logger.debug(`📋 Available keys: ${Array.from(this.templates.keys()).join(', ')}`);
    
    const template = this.templates.get(email.type);
    if (!template) {
      this.logger.error(`❌ Template not found! Requested: "${email.type}", Available: [${Array.from(this.templates.keys()).join(', ')}]`);
      throw new Error(`Template not found for email type: ${email.type}`);
    }

    // Render HTML from template
    const html = template(email.context);

    // Get subject from context or use default
    const subject = this.getEmailSubject(email.type, email.context);

    // Send email
    const info = await this.transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'SkyTimeHub'}" <${process.env.SMTP_USER}>`,
      to: email.recipientUser.email,
      subject,
      html,
    });

    this.logger.log(`Email sent to ${email.recipientUser.email}: ${info.messageId}`);
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

    await this.emailQueueRepository.save(emailQueue);
    this.logger.log(`✅ Activation email queued for user ${userId}`);
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
      reason?: string;
      leaveRequestId: number;
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

    await this.emailQueueRepository.save(emailQueue);
    this.logger.log(
      `✅ Leave request notification queued for request ${leaveRequestId}, user ${recipientUserId}`,
    );
  }

  /**
   * Enqueue leave request approved notification
   */
  async enqueueLeaveRequestApprovedNotification(
    leaveRequestId: number,
    recipientUserId: number,
    context: {
      requesterName: string;
      approverName: string;
      startDate: string;
      endDate: string;
      approvedAt: string;
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

    await this.emailQueueRepository.save(emailQueue);
    this.logger.log(
      `✅ Leave request approved notification queued for request ${leaveRequestId}`,
    );
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

    await this.emailQueueRepository.save(emailQueue);
    this.logger.log(
      `✅ Leave request rejected notification queued for request ${leaveRequestId}`,
    );
  }
}

