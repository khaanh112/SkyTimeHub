# Leave Request Module - Chi Tiết Kiến Trúc & Luồng Xử Lý

> Tài liệu mô tả chi tiết luồng xử lý Leave Request trong hệ thống SkyTimeHub.  
> Phiên bản: 1.0 | Ngày tạo: 2026-03-03

---

## Mục Lục

1. [Tổng Quan Module](#1-tổng-quan-module)
2. [Kiến Trúc & Thành Phần](#2-kiến-trúc--thành-phần)
3. [Cơ Sở Dữ Liệu & Entity](#3-cơ-sở-dữ-liệu--entity)
4. [Luồng Balance (Ledger Pattern)](#4-luồng-balance-ledger-pattern)
5. [API Endpoints Chi Tiết](#5-api-endpoints-chi-tiết)
6. [Luồng Xử Lý Chi Tiết](#6-luồng-xử-lý-chi-tiết)
7. [State Machine](#7-state-machine)
8. [Optimistic Locking](#8-optimistic-locking)
9. [Notification System](#9-notification-system)
10. [Error Handling](#10-error-handling)

---

## 1. Tổng Quan Module

Module Leave Request quản lý toàn bộ quy trình nghỉ phép từ khi nhân viên tạo đơn đến khi được duyệt/từ chối/hủy. Module sử dụng **Reserve Model** (mô hình giữ chỗ) để đảm bảo tính nhất quán của số dư phép.

### Tính năng chính:
- **Tạo đơn nghỉ phép** với validation đầy đủ (ngày tháng, overlap, balance)
- **Auto-suggest end date** cho loại phép có chính sách tự động tính
- **Cập nhật đơn** (chỉ trạng thái PENDING, bởi người tạo)
- **Duyệt/Từ chối đơn** bởi Approver với optimistic locking
- **Hủy đơn** bởi người tạo (cả PENDING và APPROVED)
- **Auto-conversion** giữa các loại phép (Paid → Unpaid khi vượt balance)
- **Per-month balance tracking** với ledger-based transactions
- **Email notifications** tự động cho tất cả các bên liên quan

---

## 2. Kiến Trúc & Thành Phần

### 2.1 Files Structure

```
src/modules/leave-requests/
├── leave-requests.controller.ts    # API endpoints (16 endpoints)
├── leave-requests.service.ts       # Business logic chính (942 lines)
├── leave-balance.service.ts        # Balance & ledger logic (1631 lines)
├── leave-requests.module.ts        # NestJS module definition
├── dto/
│   ├── create-leave-request.dto.ts # DTO tạo đơn
│   ├── update-leave-request.dto.ts # DTO cập nhật đơn
│   ├── approve-leave-request.dto.ts# DTO duyệt đơn
│   └── reject-leave-request.dto.ts # DTO từ chối đơn
└── utils/
    └── duration-calculator.ts      # Tính toán thời gian nghỉ
```

### 2.2 Dependencies

| Service | Vai trò |
|---------|---------|
| `LeaveRequestsService` | Xử lý CRUD & workflow chính |
| `LeaveBalanceService` | Quản lý balance, reserve, refund |
| `NotificationsService` | Gửi email thông báo qua queue |
| `DataSource` (TypeORM) | Transaction management |

### 2.3 Repositories (Injected)

| Repository | Entity | Mục đích |
|-----------|--------|----------|
| `LeaveRequest` | `leave_requests` | Đơn nghỉ phép chính |
| `LeaveRequestItem` | `leave_request_items` | Chi tiết phân bổ per-month |
| `LeaveRequestNotificationRecipient` | Notification recipients | HR auto + CC user |
| `LeaveType` | `leave_types` | Loại phép (Paid, Unpaid, etc.) |
| `LeaveCategory` | `leave_categories` | Nhóm loại phép |
| `UserApprover` | `user_approvers` | Mapping nhân viên → người duyệt |
| `User` | `users` | Thông tin người dùng |
| `LeaveBalanceTransaction` | `leave_balance_transactions` | Ledger transactions |

---

## 3. Cơ Sở Dữ Liệu & Entity

### 3.1 LeaveRequest Entity

```
Table: leave_requests
├── id                     (PK, auto-increment)
├── user_id                (FK → users, NOT NULL)
├── approver_id            (FK → users, NOT NULL)
├── requested_leave_type_id (FK → leave_types, nullable)
├── start_date             (DATE)
├── end_date               (DATE)
├── start_session          (ENUM: AM | PM)
├── end_session            (ENUM: AM | PM)
├── duration               (NUMERIC 5,2 - half-day count)
├── duration_days          (NUMERIC 5,2 - day count, 0.5 step)
├── start_slot             (INT - trigger-computed for overlap)
├── end_slot               (INT - trigger-computed for overlap)
├── use_comp_balance       (BOOLEAN, default false)
├── comp_used_minutes      (INT, default 0)
├── number_of_children     (INT, nullable - parental leave)
├── childbirth_method      (ENUM: natural | c_section, nullable)
├── reason                 (TEXT, NOT NULL)
├── work_solution          (TEXT, nullable)
├── status                 (ENUM: pending | approved | rejected | cancelled)
├── version                (INT - optimistic locking)
├── approved_at            (TIMESTAMPTZ, nullable)
├── rejected_at            (TIMESTAMPTZ, nullable)
├── rejected_reason        (TEXT, nullable)
├── cancelled_at           (TIMESTAMPTZ, nullable)
├── created_at             (TIMESTAMPTZ, auto)
└── updated_at             (TIMESTAMPTZ, auto)

Indexes:
  - idx_leave_requests_user_status (user_id, status)
  - idx_leave_requests_approver_status (approver_id, status)
```

### 3.2 Slot-based Overlap Detection

Hệ thống sử dụng **slot system** để phát hiện trùng lặp nửa ngày:

```
slot = (date - '2000-01-01') * 2 + (session === 'PM' ? 1 : 0)
```

- Mỗi ngày có 2 slots: AM (slot chẵn) và PM (slot lẻ)
- Overlap check: `existing.start_slot <= new.end_slot AND existing.end_slot >= new.start_slot`
- Chỉ check đơn có status `pending` hoặc `approved`
- Khi update, exclude chính đơn đang sửa

---

## 4. Luồng Balance (Ledger Pattern)

### 4.1 Reserve Model

Hệ thống sử dụng **ledger pattern** với bảng `leave_balance_transactions`:

```
Balance = SUM(CREDIT transactions) - SUM(DEBIT transactions)
```

### 4.2 Transaction Flow

| Action | Direction | Source Type | Mô tả |
|--------|-----------|-------------|--------|
| Submit | DEBIT | RESERVE | Giữ chỗ ngay khi tạo đơn |
| Approve | — | RESERVE → APPROVAL | Update in-place (không tạo row mới) |
| Reject | CREDIT | RELEASE | Trả lại quota đã giữ |
| Cancel (PENDING) | CREDIT | RELEASE | Trả lại quota đã giữ |
| Cancel (APPROVED) | CREDIT | REFUND | Hoàn trả quota đã duyệt |
| Monthly accrual | CREDIT | MONTHLY_ACCRUAL | +1 ngày/tháng (cron job) |

### 4.3 Per-Month Balance Tracking

Balance được track theo **từng tháng** (period_year, period_month):

```
Balance at (year, month) = 
  SUM(CREDIT where period ≤ month) – SUM(DEBIT where period ≤ month)
```

Khi đơn nghỉ phép span qua nhiều tháng, hệ thống **split** ngày nghỉ vào từng tháng tương ứng (monthlyAllocations).

### 4.4 Auto-Conversion

Khi balance của loại phép chính (vd: Paid Leave) không đủ:
1. Hệ thống kiểm tra `leave_type_conversions` table
2. Nếu có rule `EXCEED_BALANCE` → tự động chuyển phần vượt sang loại phép khác (vd: Unpaid Leave)
3. Frontend chỉ hiển thị loại phép chính, conversion target bị ẩn

---

## 5. API Endpoints Chi Tiết

### 5.1 Leave Request CRUD

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/leave-requests/suggest-end-date` | Employee | Gợi ý end date cho auto-calculate types |
| `POST` | `/leave-requests` | Employee | Tạo đơn nghỉ phép mới |
| `GET` | `/leave-requests` | Employee | Lấy tất cả đơn của mình |
| `GET` | `/leave-requests/:id` | All | Chi tiết 1 đơn |
| `PUT` | `/leave-requests/:id` | Employee (owner) | Cập nhật đơn PENDING |
| `PATCH` | `/leave-requests/:id/approve` | Approver | Duyệt đơn |
| `PATCH` | `/leave-requests/:id/reject` | Approver | Từ chối đơn |
| `PATCH` | `/leave-requests/:id/cancel` | Employee (owner) | Hủy đơn PENDING/APPROVED |

### 5.2 Leave Types & Balance

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/leave-requests/leave-types` | All | Danh sách loại phép theo category |
| `GET` | `/leave-requests/balance-summary` | Employee | Balance của mình |
| `GET` | `/leave-requests/balance-summary/:userId` | HR/Manager | Balance của NV cụ thể |
| `GET` | `/leave-requests/monthly-report` | Employee | Báo cáo phép theo tháng |
| `GET` | `/leave-requests/monthly-report/:userId` | HR/Manager | Báo cáo theo tháng của NV |

### 5.3 Admin

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/leave-requests/admin/initialize-balance` | HR only | Khởi tạo balance năm mới |
| `GET` | `/leave-requests/management` | HR/Approver | Quản lý đơn (HR: all, Approver: assigned) |

---

## 6. Luồng Xử Lý Chi Tiết

### 6.1 Tạo Đơn Nghỉ Phép (POST /leave-requests)

**Input DTO:**
```typescript
{
  leaveTypeId: number;          // ID loại phép
  startDate: string;            // "YYYY-MM-DD"
  endDate: string;              // "YYYY-MM-DD"
  startSession: "AM" | "PM";
  endSession: "AM" | "PM";
  reason: string;               // 5-500 chars
  workSolution?: string;        // 0-1000 chars
  ccUserIds?: number[];         // CC recipients
  numberOfChildren?: number;    // For parental leave
  childbirthMethod?: "natural" | "c_section";
  confirmDespiteWarning?: boolean;
}
```

**Luồng xử lý step-by-step:**

```
1. VALIDATE BASIC
   ├── endDate >= startDate
   └── reason không rỗng

2. LOOKUP APPROVER
   ├── Query user_approvers WHERE userId AND active=true
   └── Nếu không có → 400 "No active approver assigned"

3. VALIDATE CC LIST
   ├── Không CC chính mình
   ├── Không CC approver (tự động notify)
   └── Không CC HR users (tự động notify)

4. CHECK OVERLAP (slot-based)
   ├── Tính start_slot & end_slot
   ├── Query leave_requests WHERE status IN (pending, approved) 
   │   AND slot ranges overlap
   └── Nếu conflict → 409 "Overlaps with existing request"

5. PRE-FLIGHT BALANCE CHECK (outside transaction)
   ├── LeaveBalanceService.validateAndPrepare(...)
   ├── Tính duration (business days, exclude weekends/holidays)
   ├── Check balance đủ + auto-conversion
   ├── Nếu có warnings & chưa confirm:
   │   └── Return 400 {requiresConfirmation: true, warnings: [...]}
   └── Frontend hiện dialog confirm → re-submit with confirmDespiteWarning=true

6. DATABASE TRANSACTION
   ├── BEGIN TRANSACTION
   ├── INSERT leave_requests (status=PENDING)
   ├── LeaveBalanceService.reserveBalanceForSubmit(...)
   │   ├── Advisory lock (prevent race condition)
   │   ├── Re-validate balance (inside tx)
   │   └── INSERT leave_balance_transactions (DEBIT RESERVE per month)
   ├── INSERT leave_request_items (per-month breakdown)
   ├── INSERT notification_recipients (HR auto + CC)
   └── COMMIT

7. NOTIFICATIONS (async, outside transaction)
   ├── Email to Approver: "New leave request from {name}"
   ├── Email to HR users
   └── Email to CC recipients
```

### 6.2 Cập Nhật Đơn (PUT /leave-requests/:id)

**Điều kiện:**
- Chỉ người tạo đơn mới được sửa
- Đơn phải ở trạng thái `PENDING`

**Luồng xử lý:**

```
1. VALIDATE
   ├── Find request WHERE id AND userId
   ├── Check status === PENDING
   ├── Validate CC, overlap (exclude current), balance
   └── Pre-flight warnings (same as create)

2. TRANSACTION (Release → Re-reserve)
   ├── BEGIN TRANSACTION
   ├── Release old RESERVE transactions (CREDIT RELEASE)
   ├── UPDATE leave_requests (dates, reason, etc.)
   ├── DELETE old leave_request_items
   ├── Reserve new balance (DEBIT RESERVE per month)
   ├── INSERT new leave_request_items
   ├── Update CC recipients (delete old + insert new)
   └── COMMIT

3. NOTIFICATION
   └── Send "Request updated" to Approver, HR, CC
```

### 6.3 Duyệt Đơn (PATCH /leave-requests/:id/approve)

**Input:**
```typescript
{ version: number }  // Optimistic locking
```

**Luồng xử lý:**

```
1. AUTHORIZE
   ├── request.approverId === currentUser.id
   ├── status === PENDING
   └── version === request.version (optimistic lock)

2. TRANSACTION (RESERVE → APPROVAL)
   ├── BEGIN TRANSACTION
   ├── UPDATE status='approved', approved_at=NOW()
   ├── convertReserveToApproval(userId, requestId)
   │   └── UPDATE leave_balance_transactions 
   │       SET source_type='APPROVAL' 
   │       WHERE source_type='RESERVE' AND source_id=requestId
   └── COMMIT

3. NOTIFICATION
   ├── Email to Requester: "Your leave request approved"
   └── Email to HR + CC
```

> **Lưu ý:** Approve chỉ **update in-place** source_type từ RESERVE → APPROVAL, không tạo transaction mới. Điều này đảm bảo balance không thay đổi (chỉ thay nhãn).

### 6.4 Từ Chối Đơn (PATCH /leave-requests/:id/reject)

**Input:**
```typescript
{
  rejectedReason: string;  // Min 10 chars
  version: number;
}
```

**Luồng xử lý:**

```
1. AUTHORIZE (same as approve)

2. TRANSACTION (Release RESERVE)
   ├── BEGIN TRANSACTION
   ├── UPDATE status='rejected', rejected_at=NOW(), rejected_reason=?
   ├── releaseReserveForRejection(userId, requestId)
   │   └── INSERT CREDIT RELEASE per existing RESERVE row
   │       (gives back reserved quota)
   └── COMMIT

3. NOTIFICATION
   ├── Email to Requester: "Your leave request rejected"
   │   (includes rejection reason)
   └── Email to HR + CC
```

### 6.5 Hủy Đơn (PATCH /leave-requests/:id/cancel)

**Điều kiện:**
- Chỉ người tạo đơn
- Status phải là `PENDING` hoặc `APPROVED`

**Luồng xử lý (conditional):**

```
1. VALIDATE
   ├── request.userId === currentUser.id
   └── status IN (PENDING, APPROVED)

2. TRANSACTION (Conditional refund)
   ├── BEGIN TRANSACTION
   ├── UPDATE status='cancelled', cancelled_at=NOW()
   ├── DELETE notification_recipients
   ├── IF was APPROVED:
   │   └── refundBalanceForCancellation(items)
   │       → INSERT CREDIT REFUND (reverses APPROVAL debits)
   ├── IF was PENDING:
   │   └── releaseReserveForRejection()
   │       → INSERT CREDIT RELEASE (reverses RESERVE debits)
   └── COMMIT

3. NOTIFICATION
   ├── Email to Approver: "Leave request cancelled"
   └── Email to HR + CC
```

---

## 7. State Machine

```
                    ┌──────────┐
                    │  PENDING │
                    └────┬─────┘
                         │
           ┌─────────────┼────────────────┐
           │             │                │
     ┌─────▼─────┐ ┌────▼─────┐  ┌───────▼──────┐
     │ APPROVED  │ │ REJECTED │  │  CANCELLED   │
     └─────┬─────┘ └──────────┘  │ (from PENDING)│
           │                     └──────────────┘
     ┌─────▼──────────┐
     │   CANCELLED    │
     │(from APPROVED) │
     └────────────────┘
```

| Transition | Trigger | Actor | Balance Action |
|-----------|---------|-------|----------------|
| PENDING → APPROVED | Approve | Approver | RESERVE → APPROVAL (in-place update) |
| PENDING → REJECTED | Reject | Approver | INSERT CREDIT RELEASE |
| PENDING → CANCELLED | Cancel | Requester | INSERT CREDIT RELEASE |
| APPROVED → CANCELLED | Cancel | Requester | INSERT CREDIT REFUND |

---

## 8. Optimistic Locking

### Tại sao cần Optimistic Locking?

Tránh race condition khi:
- Employee sửa đơn **đồng thời** với Approver đang duyệt
- Approver duyệt đơn đã bị employee sửa nội dung

### Cách hoạt động:

1. Entity `LeaveRequest` có `@VersionColumn()` → TypeORM tự tăng version mỗi khi save
2. Client gửi `version` hiện tại kèm request
3. Server check: `request.version === dto.version`
4. Nếu mismatch → `409 Conflict` kèm message yêu cầu refresh

### Áp dụng cho:
- **Approve** (`PATCH /:id/approve`) - yêu cầu `version`
- **Reject** (`PATCH /:id/reject`) - yêu cầu `version`
- **Update** (`PUT /:id`) - TypeORM auto-check qua `@VersionColumn`

---

## 9. Notification System

### Recipient Types

| Type | Mô tả | Khi nào |
|------|--------|---------|
| `APPROVER` | Người duyệt | Tạo đơn, Cập nhật, Hủy |
| `HR` | Tất cả HR active (auto) | Tạo đơn, Duyệt, Từ chối, Hủy |
| `CC` | User được chọn bởi employee | Tất cả events |
| `REQUESTER` | Người tạo đơn | Duyệt, Từ chối |

### Email Context

Mỗi notification email chứa:
```typescript
{
  requesterName: string;
  approverName?: string;
  startDate: string;
  endDate: string;
  dashboardLink: string;  // Deep link vào chi tiết đơn
  // + event-specific fields:
  rejectedReason?: string;
  approvedAt?: string;
  cancelledAt?: string;
}
```

### Queue-based Processing

- Notifications được **enqueue** (không gửi trực tiếp)
- Chạy ngoài transaction để không block
- Sử dụng `email_queue` table với idempotency key
- Retry mechanism với `max_attempts`

---

## 10. Error Handling

### Custom Exceptions

| Error Code | HTTP Status | Trường hợp |
|-----------|-------------|------------|
| `INVALID_INPUT` | 400 | Validation fail (dates, reason, CC) |
| `INVALID_INPUT` | 409 | Overlap với đơn existing |
| `INVALID_INPUT` | 400 | Balance warning cần confirm |
| — | 404 | Không tìm thấy đơn |
| — | 403 | Không có quyền (approve/reject/cancel) |
| — | 409 | Version conflict (optimistic locking) |

### Transaction Safety

- Tất cả write operations sử dụng **explicit transactions** (`QueryRunner`)
- `try/catch/finally` pattern với rollback on error
- Advisory locks trong `reserveBalanceForSubmit()` để prevent race condition
- `queryRunner.release()` luôn được gọi trong `finally`

### Validation Layers

```
Layer 1: DTO validation (class-validator decorators)
  → @IsDateString, @IsEnum, @Length, @IsInt, etc.

Layer 2: Business validation (service)
  → Date logic, approver check, CC rules, overlap check

Layer 3: Balance validation (LeaveBalanceService)
  → Pre-flight check (validate & prepare)
  → In-transaction re-validation (advisory lock)

Layer 4: Database constraints
  → FK constraints, ENUM types, unique indexes, slot triggers
```

---

## Sequence Diagram

File PlantUML: [leave-request-sequence.puml](./leave-request-sequence.puml)

Để render diagram:
```bash
# Online: paste nội dung vào https://www.plantuml.com/plantuml/uml/
# VS Code: cài extension "PlantUML" → Alt+D để preview
# CLI: java -jar plantuml.jar leave-request-sequence.puml
```

---

*Tài liệu được sinh tự động dựa trên source code của module `leave-requests`.*
