# Email System - DB Polling Worker Pattern

## 📋 Tổng quan

Hệ thống email đã được refactor để sử dụng **DB Polling Worker** pattern thay vì BullMQ, giúp:
- ✅ Đơn giản hóa infrastructure (không cần Redis)
- ✅ Đảm bảo toàn vẹn dữ liệu (ACID transactions)
- ✅ Tự động retry với exponential backoff
- ✅ Recovery cho stalled processes
- ✅ Idempotency để tránh duplicate emails

## 🏗️ Kiến trúc

```
┌─────────────┐
│ Application │
│   Service   │──┐
└─────────────┘  │
                 │ Enqueue email
                 ▼
         ┌───────────────┐
         │  email_queue  │◄───────┐
         │   (Database)  │        │
         └───────────────┘        │
                 │                │
                 │ Poll (every 1 min)
                 ▼                │
         ┌───────────────┐        │
         │ EmailWorker   │        │
         │   (Cron Job)  │────────┘ Update status
         └───────────────┘
                 │
                 │ Send via SMTP
                 ▼
         ┌───────────────┐
         │   Zoho Mail   │
         │     (SMTP)    │
         └───────────────┘
```

## 📁 Cấu trúc file

### Entities
- `email_queue.entity.ts` - Email queue table theo schema mới
- `leave_request.entity.ts` - Leave request entity
- `leave-request-notification-recipient.entity.ts` - Notification recipients

### Enums
- `email-reference-kind.enum.ts` - NONE, LEAVE_REQUEST, INVITE
- `email_type.ts` - ACTIVATION, LEAVE_REQUEST_SUBMITTED, LEAVE_REQUEST_APPROVED, LEAVE_REQUEST_REJECTED
- `email_status.ts` - PENDING, PROCESSING, SENT, FAILED, CANCELLED, SKIPPED
- `recipient-type.enum.ts` - HR, CC, SYSTEM

### Services
- `notifications.service.ts` - Email queueing & SMTP sending
- `email-worker.service.ts` - DB polling worker with cron jobs
- `leave-requests.service.ts` - Leave request business logic

### Templates
- `mail-templates/activation.hbs` - Account activation email
- `mail-templates/leave-request-submitted.hbs` - New leave request notification
- `mail-templates/leave-request-approved.hbs` - Leave approved notification
- `mail-templates/leave-request-rejected.hbs` - Leave rejected notification

## 🔧 Email Queue Schema

```typescript
{
  id: number;
  recipientUserId: number;          // FK to users
  type: EmailType;                  // ACTIVATION, LEAVE_REQUEST_SUBMITTED, etc.
  referenceKind: EmailReferenceKind; // NONE, LEAVE_REQUEST, INVITE
  referenceId: number;              // FK to referenced entity
  idempotencyKey: string;           // Unique constraint
  context: Record<string, any>;     // JSON data for template rendering
  
  // Status workflow
  status: EmailStatus;              // PENDING, PROCESSING, SENT, FAILED, etc.
  attemptCount: number;             // Retry counter
  maxAttempts: number;              // Max retries (default: 3)
  nextRetryAt: Date;                // When to retry
  
  // Worker tracking
  processingStartedAt: Date;        // Lock timestamp
  workerId: string;                 // Worker ID for debugging
  
  // Completion timestamps
  sentAt: Date;
  failedAt: Date;
  cancelledAt: Date;
  skippedAt: Date;
  errorMessage: string;
}
```

## 🚀 Luồng hoạt động

### 1. Enqueue Email

```typescript
await notificationsService.enqueueActivationEmail(
  userId,
  activationToken,
  activationLink,
);
```

- Check idempotency (tránh duplicate)
- Insert vào email_queue với status = PENDING
- Set nextRetryAt = now (send immediately)

### 2. Worker Processing (Cron every 1 minute)

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async processEmailQueue() {
  // Step 1: Recover stalled emails (timeout > 10 min)
  await this.recoverStalledEmails();
  
  // Step 2: Pick pending emails (atomic update)
  const emails = await this.pickPendingEmails();
  
  // Step 3: Process emails in parallel
  await Promise.allSettled(
    emails.map(email => this.processEmail(email))
  );
}
```

### 3. Send Email

```typescript
private async processEmail(email: EmailQueue) {
  try {
    // Render template with context
    const html = template(email.context);
    
    // Send via SMTP
    await this.transporter.sendMail({...});
    
    // Mark as SENT
    await emailQueueRepository.update(email.id, {
      status: EmailStatus.SENT,
      sentAt: new Date(),
    });
  } catch (error) {
    // Handle failure with retry logic
    await this.handleEmailFailure(email, error);
  }
}
```

### 4. Retry Logic (Exponential Backoff)

```typescript
private async handleEmailFailure(email: EmailQueue, error: any) {
  const newAttemptCount = email.attemptCount + 1;
  
  if (newAttemptCount >= email.maxAttempts) {
    // Mark as FAILED permanently
    await emailQueueRepository.update(email.id, {
      status: EmailStatus.FAILED,
      failedAt: new Date(),
    });
  } else {
    // Retry with exponential backoff: 2^n minutes
    const retryDelayMinutes = Math.pow(2, newAttemptCount);
    const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
    
    await emailQueueRepository.update(email.id, {
      status: EmailStatus.PENDING,
      attemptCount: newAttemptCount,
      nextRetryAt,
    });
  }
}
```

## 🔒 Đảm bảo toàn vẹn dữ liệu

### 1. Idempotency
```typescript
idempotencyKey: `leave-req-${leaveRequestId}-${recipientUserId}`
```
- Unique constraint ngăn duplicate emails
- Safe để retry enqueue operations

### 2. Optimistic Locking
```typescript
await emailQueueRepository.update(
  { id: email.id, status: EmailStatus.PENDING }, // WHERE clause
  { status: EmailStatus.PROCESSING }
);
```
- Chỉ update nếu status vẫn là PENDING
- Tránh race condition giữa multiple workers

### 3. Stalled Email Recovery
```typescript
@Cron(CronExpression.EVERY_MINUTE)
async recoverStalledEmails() {
  const timeoutThreshold = new Date(Date.now() - 10 * 60 * 1000);
  
  const stalledEmails = await emailQueueRepository.find({
    where: {
      status: EmailStatus.PROCESSING,
      processingStartedAt: LessThan(timeoutThreshold),
    },
  });
  
  // Reset to PENDING for retry
  for (const email of stalledEmails) {
    email.status = EmailStatus.PENDING;
    email.processingStartedAt = null;
    await emailQueueRepository.save(email);
  }
}
```

## 📧 SMTP Configuration (Zoho Mail)

### Environment Variables

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM_NAME=SkyTimeHub
FRONTEND_URL=http://localhost:5173
```

### Zoho Mail Setup

1. Đăng nhập Zoho Mail
2. Vào Settings → Security → App Passwords
3. Tạo App Password mới cho "SMTP"
4. Copy password và dùng làm `SMTP_PASS`

## 🎯 Use Cases

### 1. User Activation Email
```typescript
// In UsersService.createUser()
const activationToken = this.generateActivationToken();
const savedUser = await this.usersRepository.save({
  ...userData,
  activationToken,
  status: UserStatus.INACTIVE,
});

await this.notificationsService.enqueueActivationEmail(
  savedUser.id,
  activationToken,
  `${process.env.FRONTEND_URL}/activate/${activationToken}`,
);
```

### 2. Leave Request Submitted
```typescript
// In LeaveRequestsService.createLeaveRequest()
await this.notificationsService.enqueueLeaveRequestNotification(
  leaveRequest.id,
  approverId,
  {
    requesterName: requester.username,
    approverName: approver.username,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    reason: leaveRequest.reason,
    leaveRequestId: leaveRequest.id,
  },
);
```

### 3. Leave Request Approved
```typescript
// In LeaveRequestsService.approveLeaveRequest()
await this.notificationsService.enqueueLeaveRequestApprovedNotification(
  leaveRequest.id,
  leaveRequest.userId,
  {
    requesterName: leaveRequest.user.username,
    approverName: leaveRequest.approver.username,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    approvedAt: leaveRequest.approvedAt.toISOString(),
  },
);
```

## 📊 Monitoring

### Queue Stats (Every 10 minutes)
```typescript
@Cron(CronExpression.EVERY_10_MINUTES)
async logQueueStats() {
  const stats = await emailQueueRepository
    .createQueryBuilder('email')
    .select('email.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('email.status')
    .getRawMany();
    
  logger.log(`📊 Email Queue Stats: ${JSON.stringify(stats)}`);
}
```

Output:
```
📊 Email Queue Stats: [
  { status: 'PENDING', count: 5 },
  { status: 'SENT', count: 1234 },
  { status: 'FAILED', count: 3 }
]
```

## 🐛 Troubleshooting

### Email không được gửi?
1. Check email_queue table:
   ```sql
   SELECT * FROM email_queue WHERE status = 'PENDING' ORDER BY created_at DESC LIMIT 10;
   ```
2. Check logs cho errors
3. Verify SMTP credentials
4. Check `nextRetryAt` - có thể đang chờ retry

### Email bị duplicate?
- Check idempotency_key conflicts
- Review enqueue logic

### Worker không chạy?
- Verify ScheduleModule được import trong AppModule
- Check logs khi app start: "Email Worker initialized with ID: worker-..."
- Verify cron expression

## 🚀 Deployment

### Database Migration
```sql
-- Run migration to update email_queue table
-- Add new columns: reference_kind, idempotency_key, context, etc.
```

### Install Dependencies
```bash
npm install @nestjs/schedule@^4.0.0
```

### Start Application
```bash
npm run start:dev
```

Logs should show:
```
[EmailWorkerService] Email Worker initialized with ID: worker-12345-a1b2c3d4
[EmailWorkerService] Starting email queue processing...
```

## 📈 Performance

- **Batch size**: 10 emails per cron cycle (configurable)
- **Cron frequency**: Every 1 minute
- **Retry delays**: 2, 4, 8 minutes (exponential backoff)
- **Max attempts**: 3 (configurable per email)
- **Processing timeout**: 10 minutes (auto-recovery)

## ✅ Benefits vs BullMQ

| Feature | DB Polling | BullMQ |
|---------|-----------|--------|
| Infrastructure | PostgreSQL only | PostgreSQL + Redis |
| Complexity | Low | Medium |
| ACID Support | ✅ Full | ⚠️ Limited |
| Idempotency | ✅ Native (DB constraint) | ⚠️ Manual |
| Recovery | ✅ Automatic | ⚠️ Depends on Redis |
| Debugging | ✅ SQL queries | ⚠️ Redis commands |
| Monitoring | ✅ DB queries | ⚠️ Bull Board |

## 🎓 Best Practices

1. **Always use idempotency keys** để tránh duplicate emails
2. **Set appropriate maxAttempts** dựa trên email type
3. **Monitor failed emails** và investigate error messages
4. **Use transactions** khi enqueue nhiều emails
5. **Keep context small** - chỉ data cần thiết cho template
6. **Log important events** cho debugging

---

**Tác giả**: GitHub Copilot  
**Ngày**: February 5, 2026  
**Version**: 1.0.0
