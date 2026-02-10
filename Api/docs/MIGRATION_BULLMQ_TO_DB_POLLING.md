# Migration Guide: BullMQ → DB Polling Worker

## 📝 Các thay đổi đã thực hiện

### ✅ 1. Entity Updates

#### email_queue.entity.ts - Refactored
**Removed fields:**
- `userId` → `recipientUserId` (renamed)
- `toEmail` (get from user.email)
- `subject` (generate from type + context)
- `template` (get from EmailType enum)
- `referenceType` → `referenceKind` (renamed, now enum)
- `priority`, `scheduledAt` (simplified)
- `retryCount` → `attemptCount` (renamed)
- `maxRetries` → `maxAttempts` (renamed)
- `bullJobId` (removed - no more BullMQ)

**Added fields:**
- `referenceKind: EmailReferenceKind` (enum)
- `idempotencyKey: string` (unique constraint)
- `context: jsonb` (for template data)
- `attemptCount`, `maxAttempts`, `nextRetryAt`
- `processingStartedAt`, `workerId`
- `skippedAt` (new status)

#### Indexes
```typescript
@Index('idx_email_status_retry', ['status', 'nextRetryAt'])
@Index('idx_email_processing_timeout', ['status', 'processingStartedAt'])
@Index('idx_email_pick_order', ['status', 'createdAt'])
@Index('idx_email_recipient', ['recipientUserId'])
```

### ✅ 2. New Enums

```typescript
// email-reference-kind.enum.ts
export enum EmailReferenceKind {
  NONE = 'NONE',
  LEAVE_REQUEST = 'LEAVE_REQUEST',
  INVITE = 'INVITE',
}

// email_type.ts - Updated
export enum EmailType {
  ACTIVATION = 'ACTIVATION',
  LEAVE_REQUEST_SUBMITTED = 'LEAVE_REQUEST_SUBMITTED',
  LEAVE_REQUEST_APPROVED = 'LEAVE_REQUEST_APPROVED',
  LEAVE_REQUEST_REJECTED = 'LEAVE_REQUEST_REJECTED',
}

// email_status.ts - Updated
export enum EmailStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING', // New
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  SKIPPED = 'SKIPPED', // New
}

// recipient-type.enum.ts - Moved from entity
export enum RecipientType {
  HR = 'HR',
  CC = 'CC',
  SYSTEM = 'SYSTEM',
}
```

### ✅ 3. New Services

#### notifications.service.ts
- `initializeTransporter()` - Zoho SMTP setup
- `loadTemplates()` - Load Handlebars templates
- `sendEmail(email)` - Send via SMTP (called by worker)
- `enqueueActivationEmail()` - Queue activation email
- `enqueueLeaveRequestNotification()` - Queue leave request notification
- `enqueueLeaveRequestApprovedNotification()` - Queue approval notification
- `enqueueLeaveRequestRejectedNotification()` - Queue rejection notification

#### email-worker.service.ts (NEW)
- `processEmailQueue()` - Main cron job (@Cron every minute)
- `recoverStalledEmails()` - Timeout recovery
- `pickPendingEmails()` - Atomic SELECT + UPDATE
- `processEmail()` - Send single email
- `handleEmailFailure()` - Retry logic with exponential backoff
- `logQueueStats()` - Health monitoring (@Cron every 10 minutes)

### ✅ 4. Leave Request Module (NEW)

**Files created:**
- `leave-requests.module.ts`
- `leave-requests.controller.ts`
- `leave-requests.service.ts`
- `dto/create-leave-request.dto.ts`
- `dto/update-leave-request-status.dto.ts`

**Features:**
- Create leave request
- Approve/Reject/Cancel
- Automatic email notifications to approver + HR + CC
- Transaction support for data integrity

### ✅ 5. Email Templates (Handlebars)

**Files created:**
- `mail-templates/activation.hbs`
- `mail-templates/leave-request-submitted.hbs`
- `mail-templates/leave-request-approved.hbs`
- `mail-templates/leave-request-rejected.hbs`

### ✅ 6. Module Updates

#### app.module.ts
```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { LeaveRequestsModule } from '@modules/leave-requests/leave-requests.module';

@Module({
  imports: [
    // ...
    ScheduleModule.forRoot(), // NEW
    LeaveRequestsModule, // NEW
  ],
})
```

#### notifications.module.ts
```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { EmailWorkerService } from './email-worker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailQueue]),
    ScheduleModule.forRoot(), // NEW
  ],
  providers: [
    NotificationsService,
    EmailWorkerService, // NEW
  ],
  exports: [NotificationsService],
})
```

#### users.module.ts
```typescript
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    // ...
    NotificationsModule, // NEW
  ],
})
```

#### users.service.ts
```typescript
constructor(
  @InjectRepository(User)
  private usersRepository: Repository<User>,
  private notificationsService: NotificationsService, // NEW
) {}

// In createUser()
await this.notificationsService.enqueueActivationEmail(
  savedUser.id,
  activationToken,
  activationLink,
);
```

## 🗄️ Database Migration

### SQL Migration Script

```sql
-- Backup existing email_queue table
CREATE TABLE email_queue_backup AS SELECT * FROM email_queue;

-- Drop old constraints
ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS uq_email_type_reference_user;

-- Rename/modify columns
ALTER TABLE email_queue RENAME COLUMN user_id TO recipient_user_id;
ALTER TABLE email_queue ALTER COLUMN recipient_user_id SET NOT NULL;

ALTER TABLE email_queue RENAME COLUMN retry_count TO attempt_count;
ALTER TABLE email_queue RENAME COLUMN max_retries TO max_attempts;

-- Drop old columns
ALTER TABLE email_queue DROP COLUMN IF EXISTS to_email;
ALTER TABLE email_queue DROP COLUMN IF EXISTS subject;
ALTER TABLE email_queue DROP COLUMN IF EXISTS template;
ALTER TABLE email_queue DROP COLUMN IF EXISTS priority;
ALTER TABLE email_queue DROP COLUMN IF EXISTS scheduled_at;
ALTER TABLE email_queue DROP COLUMN IF EXISTS bull_job_id;
ALTER TABLE email_queue DROP COLUMN IF EXISTS reference_type;

-- Add new columns
ALTER TABLE email_queue ADD COLUMN reference_kind VARCHAR DEFAULT 'NONE';
ALTER TABLE email_queue ADD COLUMN idempotency_key VARCHAR UNIQUE NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE email_queue ADD COLUMN context JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE email_queue ADD COLUMN next_retry_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE email_queue ADD COLUMN processing_started_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN worker_id VARCHAR;
ALTER TABLE email_queue ADD COLUMN skipped_at TIMESTAMPTZ;

-- Update status enum (if using enum type)
ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE email_status ADD VALUE IF NOT EXISTS 'SKIPPED';

-- Create new indexes
CREATE INDEX idx_email_status_retry ON email_queue(status, next_retry_at);
CREATE INDEX idx_email_processing_timeout ON email_queue(status, processing_started_at);
CREATE INDEX idx_email_pick_order ON email_queue(status, created_at);
CREATE INDEX idx_email_recipient ON email_queue(recipient_user_id);

-- Drop old indexes
DROP INDEX IF EXISTS email_queue_status_priority_scheduledat_idx;

-- Update foreign key constraint
ALTER TABLE email_queue 
  DROP CONSTRAINT IF EXISTS fk_email_queue_user,
  ADD CONSTRAINT fk_email_queue_recipient_user 
    FOREIGN KEY (recipient_user_id) 
    REFERENCES users(id) 
    ON DELETE RESTRICT;

-- Migrate existing data (if any)
UPDATE email_queue 
SET 
  reference_kind = CASE 
    WHEN reference_type = 'leave_request' THEN 'LEAVE_REQUEST'
    WHEN reference_type = 'invite' THEN 'INVITE'
    ELSE 'NONE'
  END,
  context = jsonb_build_object(
    'legacyData', true
  ),
  next_retry_at = COALESCE(scheduled_at, created_at),
  status = CASE 
    WHEN status = 'pending' THEN 'PENDING'
    WHEN status = 'sent' THEN 'SENT'
    WHEN status = 'failed' THEN 'FAILED'
    ELSE status
  END
WHERE idempotency_key IS NULL OR idempotency_key = '';

-- Generate idempotency keys for existing records (if needed)
UPDATE email_queue 
SET idempotency_key = 'migration-' || id::text || '-' || md5(random()::text)
WHERE idempotency_key IS NULL OR idempotency_key = '';
```

## 📦 Package Installation

```bash
# Install @nestjs/schedule
npm install @nestjs/schedule@^4.0.0

# Already installed (verify)
npm list nodemailer handlebars
```

## 🔧 Environment Variables

Add to `.env`:
```bash
# SMTP Configuration (Zoho Mail)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM_NAME=SkyTimeHub

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

## ✅ Testing Checklist

### 1. User Activation Email
```bash
# Create a new user via API
POST /api/v1/users
{
  "email": "test@example.com",
  "username": "testuser",
  "employeeId": "EMP26001"
}

# Check email_queue table
SELECT * FROM email_queue WHERE type = 'ACTIVATION' ORDER BY created_at DESC LIMIT 1;

# Wait 1 minute for cron to process
# Check logs for "✅ Email sent"
# Check email inbox
```

### 2. Leave Request Email
```bash
# Create leave request
POST /api/v1/leave-requests
{
  "startDate": "2026-02-10",
  "endDate": "2026-02-12",
  "reason": "Vacation",
  "ccUserIds": [2, 3]
}

# Check email_queue for notifications
SELECT * FROM email_queue WHERE reference_kind = 'LEAVE_REQUEST';

# Approve the request
PATCH /api/v1/leave-requests/1/approve

# Check for approval notification email
```

### 3. Retry Logic Test
```bash
# Temporarily break SMTP (wrong password)
# Create a user → email will fail
# Check logs for retry schedule
# Check email_queue: status = PENDING, attempt_count = 1, next_retry_at updated

# Fix SMTP
# Wait for retry → should succeed
```

### 4. Stalled Recovery Test
```bash
# Manually set an email to PROCESSING with old timestamp
UPDATE email_queue 
SET status = 'PROCESSING', 
    processing_started_at = NOW() - INTERVAL '15 minutes'
WHERE id = 1;

# Wait 1 minute for cron
# Should be recovered to PENDING
```

### 5. Health Monitoring
```bash
# Wait 10 minutes
# Check logs for queue stats
# Should see: "📊 Email Queue Stats: [...]"
```

## 🚨 Breaking Changes

### API Changes: NONE
- User-facing APIs remain unchanged
- Email sending is now asynchronous (queued) instead of synchronous

### Data Changes
- Old email_queue records need migration
- New idempotency_key constraint may conflict with existing data

### Deployment Notes
1. Run database migration BEFORE deploying new code
2. Clear old email_queue records with invalid data
3. Install @nestjs/schedule package
4. Set SMTP environment variables
5. Deploy and monitor logs for "Email Worker initialized"

## 🔄 Rollback Plan

If issues occur:

1. **Stop the new deployment**
2. **Restore from email_queue_backup**:
   ```sql
   DROP TABLE email_queue;
   ALTER TABLE email_queue_backup RENAME TO email_queue;
   ```
3. **Redeploy old version**

## 📚 References

- [EMAIL_SYSTEM_DB_POLLING.md](./EMAIL_SYSTEM_DB_POLLING.md) - Full documentation
- [NestJS Schedule](https://docs.nestjs.com/techniques/task-scheduling)
- [Nodemailer](https://nodemailer.com/)
- [Handlebars](https://handlebarsjs.com/)
- [Zoho Mail SMTP](https://www.zoho.com/mail/help/smtp-access.html)

---

**Migration Date**: February 5, 2026  
**Status**: ✅ Complete
