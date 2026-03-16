# Sequence Diagrams - SkyTimeHub

This directory contains PlantUML sequence diagrams documenting the main business flows in SkyTimeHub.

## Files

### 📄 `leave-request-flows.puml`
Contains **5 sequence diagrams** for Leave Request module:

1. **Submit Flow** - Employee submits a new leave request
   - Balance validation (check sufficient balance)
   - Reserve balance (DEBIT with RESERVE source)
   - Enqueue notifications (Approver, HR, CC recipients)
   - POST `/leave-requests`

2. **Approve Flow** - Approver approves a pending request
   - Version conflict check (optimistic locking)
   - Update reserved balance to approval (RESERVE → APPROVAL)
   - Enqueue notifications (Employee, HR, CC recipients)
   - PATCH `/leave-requests/:id/approve`

3. **Reject Flow** - Approver rejects a pending request
   - Release/Refund balance (CREDIT with RELEASE/REFUND source)
   - Enqueue notifications with rejection reason
   - PATCH `/leave-requests/:id/reject`

4. **Update Flow** - Employee updates their pending request
   - Re-validate balance with new items
   - Delete old reserved balance, create new reserve
   - Version conflict check
   - PUT `/leave-requests/:id`

5. **Cancel Flow** - Employee cancels their pending request
   - Release reserved balance
   - Enqueue notifications
   - PATCH `/leave-requests/:id/cancel`

---

### 📄 `ot-management-flows.puml`
Contains **9 sequence diagrams** for OT Management module:

1. **Create Plan Flow** - Leader creates OT plan for employees
   - Validate leader permission (must be department leader)
   - Auto-assign approver (always ADMIN user)
   - Validate employees belong to leader's department
   - Validate employee OT balance (parallel validation)
   - POST `/ot-plans`

2. **Approve Plan Flow** - Approver approves OT plan
   - Create PENDING_APPROVAL balance for each employee
   - Send approval notifications to all employees
   - PATCH `/ot-plans/:id/approve`

3. **Reject Plan Flow** - Approver rejects OT plan
   - Send rejection notifications to all employees
   - PATCH `/ot-plans/:id/reject`

4. **Cancel Plan Flow** - Creator cancels OT plan
   - Refund PENDING_APPROVAL balance if plan was approved
   - Send cancellation notifications to employees + approver
   - PATCH `/ot-plans/:id/cancel`

5. **Checkin Flow** - Employee checks in for OT work
   - Validate time window (AC-01: cannot checkin before startTime)
   - Auto-mark MISSED if checkin after endTime (AC-02)
   - POST `/ot-plans/checkin`

6. **Checkout Flow** - Employee checks out from OT work
   - Requires workOutput (1-1000 chars) and compensatoryMethod
   - Enqueue notification to leader for confirmation
   - PATCH `/ot-plans/checkout`

7. **Approve Checkin Flow** - Leader approves actual OT hours
   - Build day type cache (one DB query for all dates)
   - Split into segments (night/day boundaries using VN timezone)
   - Apply carry-over (distribute cross-midnight segments)
   - Create OT checkin items + balance transactions
   - Credit comp balance if method = COMPENSATORY_LEAVE
   - Update PENDING_APPROVAL → APPROVAL balance
   - PATCH `/ot-plans/checkin/approve`

8. **Reject Checkin Flow** - Leader rejects actual OT hours
   - Refund PENDING_APPROVAL balance
   - Reset plan_employee status to APPROVED
   - Send rejection notification with reason
   - PATCH `/ot-plans/checkin/reject`

9. **Cron Jobs** - Automated background tasks
   - **Auto-Mark Missed** (every 30 min): Mark PENDING assignments as MISSED when past endTime
   - **Auto-Checkout** (every 30 min): Auto-checkout employees who exceed threshold (checkInAt + planned_duration + 2h)

---

## Key Architecture Patterns

### ✅ Transactional Outbox Pattern for Notifications

All flows follow the same pattern for sending notifications:

```
1. INSIDE TRANSACTION:
   - Perform business logic (create/update/delete entities)
   - Enqueue notifications (INSERT INTO email_queue)
   - Return emailIds[]

2. COMMIT TRANSACTION

3. OUTSIDE TRANSACTION:
   - Call triggerImmediateSend(emailIds) [fire-and-forget]
   - Notifications service tries to send immediately
   - If fails, cronjob retries later
```

**Benefits:**
- Email queue records are part of the same atomic transaction
- No lost notifications if transaction fails
- Resilient to email sending failures (retry mechanism)
- Fast response to user (email sending is async)

### ✅ Optimistic Locking (Version Control)

All update/approve/reject flows use version checking:
- Client sends `version` number in request body
- Backend checks `WHERE id = ? AND version = ?`
- If mismatch → `409 Conflict` (request was modified by someone else)
- If match → increment version and save

### ✅ Balance Reserve → Approval Flow

**Leave Request:**
- Submit → RESERVE DEBIT (tentative reservation)
- Approve → Update RESERVE → APPROVAL DEBIT (finalized)
- Reject/Cancel → RELEASE/REFUND CREDIT (revert)

**OT Plan:**
- Approve Plan → PENDING_APPROVAL DEBIT (tentative)
- Approve Checkin → Update PENDING_APPROVAL → APPROVAL DEBIT (finalized)
- Reject Checkin/Cancel Plan → REFUND CREDIT (revert)

### ✅ Day Type Resolution & Segment Splitting (OT Module)

**Approve Checkin Flow:**
1. Build day type cache (one DB query: `WHERE date BETWEEN start AND end+7`)
2. Split into segments (detect 22:00 night boundary using VN timezone)
3. Apply carry-over (distribute cross-midnight segments to next day if > threshold)
4. Create one `ot_checkin_item` per segment with correct `dayType` and `actualDate`

---

## How to Render

### VS Code (Recommended)
1. Install extension: **PlantUML** by jebbs
2. Open `.puml` file
3. Press `Alt+D` to preview

### Online
1. Go to http://www.plantuml.com/plantuml/
2. Copy content from `.puml` file
3. Click "Submit" to render

### CLI (requires Graphviz + PlantUML JAR)
```bash
java -jar plantuml.jar leave-request-flows.puml
java -jar plantuml.jar ot-management-flows.puml
```

---

## Diagram Conventions

- **alt/else**: Conditional branches (error handling, status checks)
- **loop**: Iteration over collections (employees, recipients, segments)
- **activate/deactivate**: Participant lifeline (function call scope)
- **note right/left**: Additional context or comments
- **== Section ==**: Logical grouping of steps

---

## Related Documentation

- **API Docs**: `Api/docs/`
- **Memory Notes**: `~/.claude/projects/.../memory/MEMORY.md`
- **Date/Time Utils**: `Api/src/common/utils/date.util.ts`
- **Email Templates**: `Api/src/modules/notifications/mail-templates/`

---

Last updated: 2026-03-16
