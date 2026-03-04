# Implementation Plan: Create Leave Request — Bucket-First Refactor

> **Scope:** `createLeaveRequest` + toàn bộ allocation / balance logic  
> **Mục tiêu:**  
> - Unified bucket model: `LeaveRequestItem` = **một record per (leaveTypeId, year, month)**  
> - Balance ghi nhận đầy đủ kể cả UNPAID  
> - Xuất báo cáo theo tháng chính xác để tính công  
> - Toàn vẹn dữ liệu, chặt chẽ với xuyên tháng / xuyên năm  
> - Xoá bỏ sự phân kỳ giữa `items` và `monthlyAllocations`  

---

## Mục lục

1. [Mental Model — "Bucket-First"](#1-mental-model--bucket-first)
2. [Data Model thay đổi](#2-data-model-thay-đổi)
3. [Core Algorithm: `computeBuckets()`](#3-core-algorithm-computebuckets)
   - 3.1 [Phân loại leave type](#31-phân-loại-leave-type)
   - 3.2 [ANNUAL bucket processing](#32-annual-bucket-processing)
   - 3.3 [POLICY / SOCIAL bucket processing](#33-policy--social-bucket-processing)
   - 3.4 [PARENTAL bucket processing](#34-parental-bucket-processing)
   - 3.5 [COMPENSATORY / OTHER bucket processing](#35-compensatory--other-bucket-processing)
4. [UNPAID balance semantics](#4-unpaid-balance-semantics)
5. [Lock strategy](#5-lock-strategy)
6. [Flow tổng thể `createLeaveRequest`](#6-flow-tổng-thể-createLeaverequest)
7. [Cases covered](#7-cases-covered)
8. [Edge cases & guards](#8-edge-cases--guards)
9. [Monthly report contract](#9-monthly-report-contract)
10. [File structure mới](#10-file-structure-mới)
11. [Migration tasks](#11-migration-tasks-theo-phase)
12. [API contract thay đổi](#12-api-contract-thay-đổi)

---

## 1. Mental Model — "Bucket-First"

### Nguyên tắc

> **Mỗi (leaveTypeId, year, month) là một bucket độc lập.**  
> Tất cả tính toán allocation, conversion, reserve đều diễn ra ở cấp độ bucket.  
> Không tồn tại `items` tổng-hợp (aggregated ConversionItem) nữa — bucket chính là nguồn sự thật.

```
Request: 2026-12-25 AM → 2027-01-08 PM  (ANNUAL leave)

splitByMonth → buckets:
  ┌─────────────────────────────────────────────┐
  │ bucket[0]: {year:2026, month:12, days: 3.0} │
  │ bucket[1]: {year:2027, month:01, days: 5.0} │  
  └─────────────────────────────────────────────┘
               │ Per-bucket, dùng balance của NĂM TƯƠNG ỨNG
               ▼
  ┌─────────────────────────────────────────────┐
  │ ALLOC[0]: {2026/12, PAID, 1.0}              │
  │ ALLOC[1]: {2026/12, UNPAID, 2.0}            │ ← balance 2026 chỉ còn 1 ngày
  │ ALLOC[2]: {2027/01, PAID, 5.0}              │ ← balance 2027 reset = đầy
  └─────────────────────────────────────────────┘
               │ ALLOC[] = LeaveRequestItem[] = BalanceTx DEBIT RESERVE
               ▼  (1-1 mapping, không cần extra mapping layer)
```

### Sự thay đổi về concept

| Trước | Sau |
|-------|-----|
| `items[]` (tổng hợp Per-type) + `monthlyAllocations[]` (Per-month) | Chỉ `allocations[]` = Per-(type, year, month) |
| `monthlyAllocations` build sau khi có `items`, dùng waterfall | Mỗi bucket **trực tiếp** quyết định loại phân bổ |
| Fallback: nếu `monthlyAllocations.length === 0` thì dùng `items` | Không cần fallback, `allocations` luôn có dữ liệu |
| Unpaid skip DEBIT reserve | Unpaid có DEBIT RESERVE đầy đủ |

---

## 2. Data Model thay đổi

### 2.1 `LeaveRequestItem` — không đổi schema, đổi semantics

```
leave_request_items
  id                  BIGINT PK
  leave_request_id    INT FK → leave_requests.id  CASCADE DELETE
  leave_type_id       BIGINT FK → leave_types.id
  amount_days         NUMERIC(5,2)       -- phải > 0
  period_year         INT
  period_month        INT                -- 1..12
  note                TEXT nullable
  created_at          TIMESTAMP

UNIQUE (leave_request_id, leave_type_id, period_year, period_month)
```

**Mới:** constraint unique phải được giữ nguyên và là **hard enforcement** của bucket uniqueness.

### 2.2 `LeaveBalanceTransaction` — thêm DEBIT cho UNPAID

```
leave_balance_transactions
  ...
  direction     ENUM('CREDIT','DEBIT')
  source_type   ENUM('MONTHLY_ACCRUAL','RESERVE','APPROVAL','RELEASE','REFUND','MANUAL_ADJUSTMENT','UNPAID_TRACKING')
```

**Thêm source_type `UNPAID_TRACKING`** để reserve UNPAID riêng biệt, hoặc giữ `RESERVE` nhưng không skip. Xem Section 4.

### 2.3 `LeaveTypePolicy` — thêm field cho UNPAID

Không cần thay đổi schema. UNPAID policy đã có `annual_limit_days`. Cần đảm bảo:
- Seed UNPAID policy với `annual_limit_days = 30` (ví dụ)
- `monthly_limit_days` = null cho UNPAID (không accrual theo tháng)
- `getBalance()` cho UNPAID phải dùng **limit-based model** (không dùng CREDIT accrual)

---

## 3. Core Algorithm: `computeBuckets()`

### Interface mới (thay thế `LeaveValidationResult`)

```typescript
export interface BucketAllocation {
  year: number;
  month: number;           // 1..12
  leaveTypeId: number;
  leaveTypeCode: string;
  amountDays: number;
  note: string;
  isUnpaid: boolean;       // convenience flag cho reporting
}

export interface AllocationResult {
  durationDays: number;                  // tổng ngày của request (tất cả buckets)
  allocations: BucketAllocation[];       // SOURCE OF TRUTH — thay thế cả items và monthlyAllocations
  warnings: string[];
  canProceed: boolean;
  /** Aggregated summary — derived từ allocations (không persist) */
  summary: { leaveTypeCode: string; totalDays: number }[];
}
```

> `items: ConversionItem[]` bị xóa. Frontend chỉ nhận `allocations[]` hoặc `summary[]`.

### 3.1 Phân loại leave type

```
computeBuckets(employeeId, leaveTypeId, startDate, endDate, startSession, endSession, opts)
  │
  ├─ Lookup leaveType, policy, categoryCode
  │
  ├─ calculateDuration() → durationDays
  │
  ├─ splitLeaveDaysByMonth() → rawBuckets[]  ← luôn gọi, kể cả PARENTAL
  │    (rawBuckets = [{year, month, durationDays, slots}, ...])
  │
  ├─ switch(categoryCode + leaveType.code):
  │    ├─ 'ANNUAL'        → processAnnualBuckets()
  │    ├─ 'POLICY'        → processPolicySocialBuckets()
  │    ├─ 'SOCIAL'        → processPolicySocialBuckets()
  │    ├─ 'PARENTAL'      → processParentalBuckets()
  │    └─ default         → processDirectBuckets()
  │
  └─ return AllocationResult
```

---

### 3.2 ANNUAL bucket processing

**Mục tiêu:** mỗi tháng kiểm tra balance riêng của năm tương ứng, không mượn giữa tháng, overflow → UNPAID per tháng.

```typescript
async processAnnualBuckets(
  employeeId: number,
  leaveType: LeaveType,
  rawBuckets: MonthlyDuration[],     // [{year, month, durationDays}]
  excludeRequestId: number | undefined,
  manager: EntityManager | undefined,
): Promise<{ allocations: BucketAllocation[]; warnings: string[] }>
```

**Pseudo-code:**

```
allocations = []
warnings = []
unpaidType = getLeaveTypeByCode('UNPAID')
unpaidPolicy = getActivePolicy(unpaidType.id, startDate)

// Track running paid used PER YEAR — reset khi sang năm khác ✅
runningPaidByYear = Map<year, number>   // khởi tạo 0 cho từng năm xuất hiện

for bucket in rawBuckets:
  year = bucket.year
  month = bucket.month
  need = bucket.durationDays
  
  runningUsed = runningPaidByYear.get(year) ?? 0
  
  // Balance = CREDIT(accrual đến tháng month) − DEBIT(đến tháng month, exclude current request)
  // getBalance() đã handle accrual cap (monthlyLimitDays * month)
  paidAvailable = getBalance(employeeId, leaveType.id, year, excludeRequestId, month, manager)
  
  effectiveBalance = max(paidAvailable − runningUsed, 0)
  paidTake = min(need, effectiveBalance)
  unpaidTake = need − paidTake
  
  if paidTake > 0:
    allocations.push({ year, month, leaveTypeId: leaveType.id, amountDays: paidTake, isUnpaid: false })
    runningPaidByYear.set(year, runningUsed + paidTake)
  
  if unpaidTake > 0:
    allocations.push({ year, month, leaveTypeId: unpaidType.id, amountDays: unpaidTake, isUnpaid: true })

// Validate UNPAID total per year against annual limit
unpaidByYear = groupBy(allocations.filter(isUnpaid), a => a.year)
for [year, unpaids] in unpaidByYear:
  totalUnpaidThisRequest = sum(unpaids.amountDays)
  alreadyUsedUnpaid = getUnpaidUsed(employeeId, unpaidType.id, year, excludeRequestId, manager)
  limit = unpaidPolicy?.annualLimitDays ?? Infinity
  
  if alreadyUsedUnpaid + totalUnpaidThisRequest > limit:
    warnings.push(`Unpaid leave limit ${limit} days/year for ${year} may be exceeded...`)
  
  if totalUnpaidThisRequest > 0:
    warnings.push(`${totalUnpaidThisRequest} day(s) in ${year} will be UNPAID due to insufficient balance.`)

return { allocations, warnings }
```

**Cases:**
- ✅ Xuyên tháng cùng năm: `runningPaidByYear` tích lũy đúng
- ✅ Xuyên năm (2026→2027): `runningPaidByYear` reset khi year khác, balance 2027 không bị ảnh hưởng bởi bao nhiêu đã dùng trong 2026
- ✅ Tháng giữa năm có balance = 0 (chưa accrual đủ): toàn bộ tháng đó → UNPAID
- ✅ Request đúng 0.5 ngày cuối tháng: `paidTake = 0.5`, step 0.5 được handle bởi `numeric(5,2)`
- ✅ UNPAID per-month được track riêng từng tháng → monthly report đúng

---

### 3.3 POLICY / SOCIAL bucket processing

**Khác với ANNUAL:** loại nghỉ này có `maxPerRequestDays` (entitlement cố định). Phần vượt → PAID → UNPAID.

```typescript
async processPolicySocialBuckets(
  employeeId: number,
  leaveType: LeaveType,
  policy: LeaveTypePolicy | null,
  rawBuckets: MonthlyDuration[],
  conversions: LeaveTypeConversion[],
  excludeRequestId: number | undefined,
  manager: EntityManager | undefined,
): Promise<{ allocations: BucketAllocation[]; warnings: string[] }>
```

**Pseudo-code:**

```
allocations = []
entitlementLeft = policy?.maxPerRequestDays ?? Infinity

// Phase 1: Phân bổ entitlement (loại gốc) theo waterfall qua buckets
for bucket in rawBuckets:
  take = min(bucket.durationDays, entitlementLeft)
  if take > 0:
    allocations.push({ year: bucket.year, month: bucket.month, leaveTypeId: leaveType.id, amountDays: take })
    entitlementLeft -= take
  bucket.excessDays = bucket.durationDays - take   // overflow của bucket này

// Phase 2: Excess buckets → PAID → UNPAID (per-bucket, không aggregate)
excessBuckets = rawBuckets.filter(b => b.excessDays > 0)
exceedConv = conversions.find(c => c.reason === 'EXCEED_MAX_PER_REQUEST')
paidType = exceedConv?.toLeaveType

if excessBuckets.length > 0 && paidType:
  runningPaidByYear = Map<year, number>
  
  for bucket in excessBuckets:
    year = bucket.year
    month = bucket.month
    need = bucket.excessDays
    runningUsed = runningPaidByYear.get(year) ?? 0
    
    // Check paid balance PER MONTH (same as ANNUAL logic)
    paidAvail = getBalance(employeeId, paidType.id, year, excludeRequestId, month, manager)
    effectiveBalance = max(paidAvail - runningUsed, 0)
    paidTake = min(need, effectiveBalance)
    unpaidNeed = need - paidTake
    
    if paidTake > 0:
      allocations.push({ year, month, leaveTypeId: paidType.id, amountDays: paidTake })
      runningPaidByYear.set(year, runningUsed + paidTake)
    
    if unpaidNeed > 0:
      unpaidType = getUnpaidTypeFromConversion(paidType)
      allocations.push({ year, month, leaveTypeId: unpaidType.id, amountDays: unpaidNeed, isUnpaid: true })
      warnings.push(...)

return { allocations, warnings }
```

**Cases:**
- ✅ Nghỉ tang 3 ngày (limit 3): tất cả 3 ngày = policy type, dù trải 2 tháng → phase 1 đủ
- ✅ Nghỉ tang 5 ngày (limit 3): 3 ngày = policy, 2 ngày = PAID (nếu đủ) hoặc UNPAID
- ✅ Excess qua 2 tháng: mỗi tháng check balance riêng → không borrow
- ✅ Policy không có `maxPerRequestDays`: toàn bộ là policy type, không convert
- ✅ Xuyên năm với excess: `runningPaidByYear` reset đúng

---

### 3.4 PARENTAL bucket processing

**Nguyên tắc quan trọng:** PARENTAL **phải** gọi `splitLeaveDaysByMonth` (calendar split cho nữ, working-day split cho nam), không để `monthlyBuckets = []`.

```typescript
async processParentalBuckets(
  employeeId: number,
  leaveType: LeaveType,
  rawBuckets: MonthlyDuration[],    // split từ toàn bộ date range
  durationDays: number,
  parentalEntitlementDays: number,  // tính từ gender + numChildren + method
  conversions: LeaveTypeConversion[],
  excludeRequestId: number | undefined,
  manager: EntityManager | undefined,
): Promise<{ allocations: BucketAllocation[]; warnings: string[] }>
```

**Pseudo-code (nữ - calendar days):**

```
allocations = []
entitlementLeft = parentalEntitlementDays   // e.g. 180 days
excessWorkingDays = durationDays - parentalEntitlementDays (if > 0 else 0)

// Phase 1: Entitlement = calendar days theo tháng
for bucket in rawBuckets:
  // rawBuckets đây là calendar buckets (weekends included), không phải working-day buckets
  take = min(bucket.durationDays, entitlementLeft)
  if take > 0:
    allocations.push({ ..., leaveTypeId: leaveType.id, amountDays: take, isUnpaid: false })
    entitlementLeft -= take

// Phase 2: Excess working days → PAID → UNPAID
if excessWorkingDays > 0:
  excessBuckets = computeExcessWorkingBuckets(rawBuckets, ...endOfEntitlement)
  // tương tự POLICY phase 2 nhưng dùng working-day buckets cho excess
  ...

return { allocations, warnings }
```

**Cases:**
- ✅ Nữ 180 ngày không excess: 180 calendar days split theo tháng
- ✅ Nữ 200 ngày: 180 calendar + 20 working excess → excess → PAID → UNPAID per working-day bucket
- ✅ Nam sinh thường 5 ngày: working-day buckets, check balance
- ✅ Nam sinh mổ 7 ngày: working-day buckets, check balance
- ✅ Monthly report: nữ tháng 1 = X calendar days, tháng 2 = Y calendar days → đúng

---

### 3.5 COMPENSATORY / OTHER bucket processing

```typescript
processDirectBuckets(
  leaveType: LeaveType,
  rawBuckets: MonthlyDuration[],
): BucketAllocation[]
```

```
// Trực tiếp map rawBuckets → allocations, không check balance
for bucket in rawBuckets:
  allocations.push({ year: bucket.year, month: bucket.month, leaveTypeId: leaveType.id, amountDays: bucket.durationDays })
```

> COMP balance check (nếu cần) sẽ bổ sung sau, hiện tại treat như direct.

---

## 4. UNPAID balance semantics

### Vấn đề hiện tại

- UNPAID không có CREDIT accrual transaction → `getBalance(UNPAID)` = 0 - DEBIT = âm → vô nghĩa
- UNPAID skip DEBIT reserve → limit check không hoạt động
- `getUsedDays` count DEBIT transactions: không có DEBIT → usedDays = 0 mãi

### Giải pháp: Limit-based model cho UNPAID

**Balance model:**
```
UNPAID available(year) = annualLimitDays − usedUnpaidDays(year)

usedUnpaidDays(year) = SUM(DEBIT where source_type IN ('RESERVE','APPROVAL') AND period_year = year)
                     − SUM(CREDIT where source_type IN ('RELEASE','REFUND') AND period_year = year)
```

**`getUnpaidBalance()` — hàm riêng:**
```typescript
async getUnpaidBalance(
  employeeId: number,
  unpaidTypeId: number,
  year: number,
  excludeRequestId?: number,
  manager?: EntityManager,
): Promise<number> {
  const policy = await this.getActivePolicy(unpaidTypeId, `${year}-01-01`);
  const limit = policy?.annualLimitDays ? Number(policy.annualLimitDays) : Infinity;
  const used = await this.getUsedDays(employeeId, unpaidTypeId, year, excludeRequestId, manager);
  return Math.max(limit - used, 0);
}
```

**Reserve cho UNPAID:**
```typescript
// KHÔNG skip UNPAID nữa
// Tất cả allocations (kể cả isUnpaid = true) đều tạo DEBIT RESERVE
for (const alloc of finalResult.allocations) {
  reserveTxs.push({
    employeeId,
    leaveTypeId: alloc.leaveTypeId,
    periodYear: alloc.year,
    periodMonth: alloc.month,
    direction: BalanceTxDirection.DEBIT,
    amountDays: alloc.amountDays,
    sourceType: BalanceTxSource.RESERVE,    // giữ nguyên, không cần UNPAID_TRACKING
    sourceId: leaveRequestId,
    note: `Leave #${leaveRequestId}...`
  });
}
```

**Warning cho UNPAID** (khi vượt limit):
```
"Bạn sẽ vượt quá giới hạn 30 ngày nghỉ không lương trong năm 2026.
 Đã dùng: 28 ngày. Request này thêm: 5 ngày (tháng 11: 2 ngày, tháng 12: 3 ngày).
 Tổng sẽ là 33/30 ngày."
```

> Warning không block submit — user phải `confirmDespiteWarning = true` để tiếp tục.

---

## 5. Lock strategy

### Deterministic lock ordering (tránh deadlock)

```typescript
interface LockKey { typeId: number; year: number }

function computeLockKeys(
  primaryTypeId: number,
  startDate: string,
  endDate: string,
  previewAllocations: BucketAllocation[],
): LockKey[] {
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate + 'T00:00:00').getFullYear();
  
  // Primary type × all years
  const keys: LockKey[] = [];
  for (let y = startYear; y <= endYear; y++) {
    keys.push({ typeId: primaryTypeId, year: y });
  }
  
  // Conversion types từ preview allocations × all years
  const convTypeIds = new Set(
    previewAllocations
      .map(a => a.leaveTypeId)
      .filter(id => id !== primaryTypeId)
  );
  for (const typeId of convTypeIds) {
    for (let y = startYear; y <= endYear; y++) {
      keys.push({ typeId, year: y });
    }
  }
  
  // Deduplicate + sort deterministic (typeId ASC, year ASC)
  const seen = new Set<string>();
  return keys
    .filter(k => { const key = `${k.typeId}-${k.year}`; return seen.has(key) ? false : (seen.add(key), true); })
    .sort((a, b) => a.typeId !== b.typeId ? a.typeId - b.typeId : a.year - b.year);
}
```

### Acquire locks

```typescript
async acquireAllLocks(manager, employeeId, lockKeys: LockKey[]): Promise<void> {
  for (const key of lockKeys) {
    await manager.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [employeeId, key.typeId * 10000 + key.year]
    );
  }
}
```

> **Tại sao không deadlock:** Tất cả sessions đều lock theo `typeId ASC, year ASC` → không có chu kỳ chờ.

### Verify sau lock

Sau khi acquire lock và re-compute, so sánh với preview:

```typescript
function allocationChanged(preview: AllocationResult, locked: AllocationResult): boolean {
  // Compare tổng ngày per type per (year, month)
  const summarize = (r: AllocationResult) =>
    r.allocations
      .map(a => `${a.leaveTypeId}-${a.year}-${a.month}:${a.amountDays}`)
      .sort()
      .join('|');
  return summarize(preview) !== summarize(locked);
}

if (allocationChanged(preview, lockedResult)) {
  throw new AppException(
    ErrorCode.CONFLICT,
    'Balance has changed since your preview. Please refresh and try again.',
    409,
  );
}
```

---

## 6. Flow tổng thể `createLeaveRequest`

```
createLeaveRequest(userId, dto)
  │
  ├─ [1] Input validation
  │    ├─ endDate >= startDate
  │    ├─ CC không trùng requester/approver/HR
  │    └─ Approver lookup
  │
  ├─ [2] Overlap check
  │    └─ checkOverlap(userId, dates)
  │
  ├─ [3] Preview (DRY-RUN, ngoài transaction, không lock)
  │    └─ allocationService.preview(userId, dto)
  │         ├─ calculateDuration()
  │         ├─ splitLeaveDaysByMonth()    (luôn gọi)
  │         ├─ processXxxBuckets()        (per category)
  │         └─ return AllocationResult { allocations[], warnings[], durationDays, summary[] }
  │
  ├─ [4] Warning gate
  │    └─ if (warnings.length > 0 && !dto.confirmDespiteWarning)
  │         → throw AppException(CONFIRMATION_REQUIRED, { warnings, durationDays, summary[], isPreview: true })
  │
  ├─ [5] BEGIN TRANSACTION
  │    │
  │    ├─ [5a] Save LeaveRequest (get ID)
  │    │       durationDays = preview.durationDays  (không save lại sau lock)
  │    │
  │    ├─ [5b] lockAndReserve(manager, userId, requestId, dto, preview)
  │    │        ├─ computeLockKeys(primaryTypeId, dates, preview.allocations)
  │    │        ├─ acquireAllLocks(manager, userId, lockKeys)   ← sorted, deduped
  │    │        ├─ re-computeBuckets(...)                       ← single re-compute under lock
  │    │        ├─ allocationChanged(preview, locked)?
  │    │        │    YES → throw ConflictException (rollback)
  │    │        │    NO  → continue
  │    │        └─ writeReserveTransactions(manager, userId, requestId, locked.allocations)
  │    │              — DEBIT RESERVE for ALL allocations (kể cả UNPAID)
  │    │
  │    ├─ [5c] saveLeaveRequestItems(manager, requestId, locked.allocations)
  │    │        — One row per allocation (direct 1-1 mapping, không cần waterfall)
  │    │        — Unique constraint (requestId, leaveTypeId, year, month) enforce integrity
  │    │
  │    ├─ [5d] saveNotificationRecipients(manager, requestId, ...)
  │    │
  │    └─ [5e] COMMIT
  │
  ├─ [6] Post-commit: enqueueNotifications()
  │
  └─ [7] Return reloaded LeaveRequest
```

**Key changes vs. current:**

| Step | Trước | Sau |
|------|-------|-----|
| Pre-flight | `validateAndPrepare()` (monolith) | `allocationService.preview()` (bucket-first) |
| Items save | `if monthlyAllocations.length > 0` fallback sang `items` | Trực tiếp từ `locked.allocations`, không fallback |
| Lock | Sequential per year, partial | All keys upfront, sorted deterministic |
| Re-validate | 2-3 lần | 1 lần dưới lock |
| UNPAID reserve | Skip | Reserve đầy đủ |
| Conflict detection | Không có | `allocationChanged()` check |

---

## 7. Cases covered

### 7.1 ANNUAL leave

| Case | Expected behavior |
|------|------------------|
| 3 ngày, balance đủ, cùng tháng | 3 PAID allocations trong 1 bucket |
| 5 ngày, balance chỉ 2 ngày | 2 PAID + 3 UNPAID trong cùng bucket |
| Xuyên tháng (tháng 3: 2 ngày, tháng 4: 3 ngày), balance tháng 3 = 1 ngày, tháng 4 = 3 ngày | tháng 3: 1 PAID + 1 UNPAID; tháng 4: 3 PAID (balance reset đúng) |
| Xuyên năm (tháng 12/2026: 3 ngày, tháng 1/2027: 5 ngày) | Tính balance 2026 cho bucket 12/2026; tính balance 2027 cho bucket 1/2027 — độc lập |
| Balance âm (do previous error/manual debit) | `max(paidAvailable, 0)` → toàn bộ UNPAID |
| Request từng tháng nhỏ, 0.5 ngày | `amount_days = 0.5`, `numeric(5,2)` OK |
| UNPAID vượt annual limit | Warning "Exceeded 30 days/year", vẫn có thể confirm |

### 7.2 POLICY / SOCIAL leave

| Case | Expected behavior |
|------|------------------|
| Tang 3 ngày, limit = 3, cùng tháng | 3 ngày policy type, không convert |
| Tang 5 ngày, limit = 3, balance paid đủ | 3 ngày policy + 2 ngày PAID |
| Tang 5 ngày, limit = 3, balance paid = 0 | 3 ngày policy + 2 ngày UNPAID + warning |
| Policy không có maxPerRequestDays | Toàn bộ là policy type |
| Xuyên 2 tháng, excess 3 ngày (tháng 1: 1 ngày, tháng 2: 2 ngày) | Excess xử lý per bucket, balance check riêng từng tháng |

### 7.3 PARENTAL leave

| Case | Expected behavior |
|------|------------------|
| Nữ 180 ngày đúng entitlement | 180 calendar days split theo tháng real calendar |
| Nữ 200 ngày (excess 20 working days) | 180 calendar + 20 working days → PAID/UNPAID |
| Nam sinh thường 5 ngày | 5 working days, check PAID balance |
| Nam sinh mổ 7 ngày | 7 working days, check PAID balance |
| Nữ, con thứ 2 (210 ngày = 180+30) | entitlementDays = 210 |

### 7.4 Concurrency

| Case | Expected behavior |
|------|------------------|
| 2 users cùng lúc, cùng employee | Advisory lock serialize → user B chờ user A commit |
| User A và B cùng employee, A: PAID lock dùng typeId=1; B: UNPAID lock typeId=2 | Sorted lockKeys: cả 2 sẽ lock typeId=1 trước → không deadlock |
| User submit khi đang trong tx khác cùng year | `pg_advisory_xact_lock` block cho đến khi TX commit/rollback |
| Preview khác commit (concurrent update giữa) | `allocationChanged()` → 409 Conflict → user retry |

---

## 8. Edge cases & guards

### 8.1 Zero / negative duration

```typescript
if (durationDays <= 0) {
  throw new AppException(ErrorCode.INVALID_INPUT, 'Leave duration must be at least 0.5 days', 400);
}
```

### 8.2 `splitLeaveDaysByMonth` trả về empty (weekend only)

```typescript
const rawBuckets = await splitLeaveDaysByMonth(...);
if (rawBuckets.length === 0 || rawBuckets.every(b => b.durationDays === 0)) {
  throw new AppException(ErrorCode.INVALID_INPUT, 'Selected date range contains no working days', 400);
}
```

### 8.3 Unique constraint violation khi save items

Entity có: `@Unique('uq_lri_request_type_period', ['leaveRequestId', 'leaveTypeId', 'periodYear', 'periodMonth'])`

**Nguyên nhân có thể xảy ra:** Bug trong `computeBuckets` tạo 2 allocations cùng (type, year, month).

**Guard:**
```typescript
function validateAllocationsNoDuplicateBucket(allocations: BucketAllocation[]): void {
  const seen = new Set<string>();
  for (const a of allocations) {
    const key = `${a.leaveTypeId}-${a.year}-${a.month}`;
    if (seen.has(key)) {
      throw new Error(`BUG: duplicate allocation bucket ${key}`);  // Internal error
    }
    seen.add(key);
  }
}
// Gọi trước khi save, trong cả preview và locked result
```

### 8.4 `amount_days` = 0 trong allocation

```typescript
allocations = allocations.filter(a => a.amountDays > 0);
```

### 8.5 Balance = `NaN` / `null` từ DB

```typescript
const paidAvailable = parseFloat(rawResult ?? '0') || 0;
```

### 8.6 Xuyên năm với nhiều hơn 2 năm

```typescript
// Không giới hạn, loop for y = startYear to endYear chạy đúng với 3+ năm
// rawBuckets cũng sẽ có entries cho 3+ năm
// runningPaidByYear Map xử lý được
```

> **Giới hạn thực tế:** Policy thường giới hạn maxPerRequestDays. ANNUAL thường không quá 30 ngày → không xuyên quá 2 tháng. Nhưng code không enforce điều này.

### 8.7 PARENTAL endDate vượt quá endDate của request

```typescript
// Nếu user chọn dates ngắn hơn entitlement → durationDays < parentalEntitlementDays
// → excessWorkingDays = 0 → không có excess processing
// rawBuckets.reduce(sum, durationDays) sẽ khớp với durationDays tính từ dates
```

### 8.8 Min duration check

```typescript
if (policy?.minDurationDays && durationDays < Number(policy.minDurationDays)) {
  throw new AppException(ErrorCode.INVALID_INPUT, `Minimum duration for ${leaveType.name} is ${policy.minDurationDays} days`, 400);
}
```

### 8.9 SUM(allocations.amountDays) ≠ durationDays

```typescript
function assertAllocationSum(allocations: BucketAllocation[], expected: number): void {
  const total = allocations.reduce((s, a) => s + Number(a.amountDays), 0);
  const rounded = Math.round(total * 2) / 2;
  const expectedRounded = Math.round(expected * 2) / 2;
  if (Math.abs(rounded - expectedRounded) > 0.01) {
    throw new Error(`BUG: allocations sum ${rounded} ≠ expected ${expectedRounded}`);
  }
}
```

---

## 9. Monthly report contract

### Requirement

Báo cáo tháng cần biết: nhân viên X trong tháng Y có bao nhiêu ngày nghỉ loại Z (paid/unpaid).

### Query

```sql
-- Ngày nghỉ theo nhân viên, theo tháng
SELECT
  lr.user_id,
  lri.period_year,
  lri.period_month,
  lt.code        AS leave_type_code,
  lt.name        AS leave_type_name,
  SUM(lri.amount_days) AS total_days,
  MIN(lr.status)    AS status
FROM leave_request_items lri
JOIN leave_requests lr ON lr.id = lri.leave_request_id
JOIN leave_types lt    ON lt.id = lri.leave_type_id
WHERE lr.user_id = :userId
  AND lri.period_year = :year
  AND lri.period_month = :month
  AND lr.status IN ('pending', 'approved')
GROUP BY lr.user_id, lri.period_year, lri.period_month, lt.code, lt.name
ORDER BY lt.code;
```

### Tại sao bucket model đảm bảo đúng

| Trước (waterfall sau aggregation) | Sau (bucket-first) |
|-----------------------------------|-------------------|
| Policy 1 ngày có thể bị split 0.5+0.5 theo tháng do waterfall | Không split: bucket tháng nào thì item nằm trong tháng đó |
| Parental 180 ngày gộp vào 1 item tháng startDate | Split đúng: tháng 1 = X ngày, tháng 2 = Y ngày theo lịch thực |
| ANNUAL xuyên năm: balance 2027 bị ảnh hưởng bởi 2026 | Mỗi bucket độc lập, `period_year` = năm đúng |
| Unpaid không có item (skip DEBIT) | Unpaid có item với `period_year`, `period_month` đúng |

### Report columns mapping

```
leave_request_items.period_year   → tháng nào nhân viên vắng mặt
leave_request_items.period_month  → tháng nào nhân viên vắng mặt
leave_request_items.leave_type_id → loại nghỉ (PAID / UNPAID / PARENTAL / POLICY...)
leave_request_items.amount_days   → số ngày nghỉ loại đó trong tháng đó
leave_requests.status             → filter chỉ approved để tính công chính thức
```

---

## 10. File structure mới

```
src/modules/leave-requests/
│
├─ leave-requests.service.ts           ← Orchestrator (mỏng hơn)
├─ leave-requests.controller.ts
│
├─ allocation/                         ← NEW
│   ├─ allocation.service.ts           ← preview() + lockAndReserve()
│   ├─ annual-processor.ts             ← processAnnualBuckets()
│   ├─ policy-social-processor.ts      ← processPolicySocialBuckets()
│   ├─ parental-processor.ts           ← processParentalBuckets()
│   ├─ direct-processor.ts             ← processDirectBuckets()
│   └─ allocation.types.ts             ← BucketAllocation, AllocationResult interfaces
│
├─ balance/                            ← Extracted từ LeaveBalanceService
│   ├─ balance-ledger.service.ts       ← getBalance(), getUnpaidBalance(), getUsedDays()
│   │                                     writeReserveTransactions(), releaseReserve(), refund()
│   ├─ balance-accrual.service.ts      ← initializeYearlyBalance(), monthly accrual
│   └─ balance-summary.service.ts      ← getEmployeeBalanceSummary() (cho UI dashboard)
│
├─ utils/
│   ├─ duration-calculator.ts          ← Giữ nguyên
│   ├─ lock-key-calculator.ts          ← computeLockKeys() NEW
│   └─ allocation-validator.ts         ← assertNoDuplicateBucket(), assertAllocationSum() NEW
│
├─ dto/
│   ├─ create-leave-request.dto.ts
│   ├─ update-leave-request.dto.ts
│   └─ allocation-preview.dto.ts       ← Response DTO cho preview API
│
└─ leave-balance.service.ts            ← DEPRECATED: delegate to new services
                                          Giữ lại để backward compat, sẽ xóa sau Phase 3
```

---

## 11. Migration tasks theo Phase

### Phase 1 — Fix critical bugs (ưu tiên cao, ~2 ngày)

- [ ] **[P1-1]** Fix `runningPaidUsedByThisRequest` → replace với `runningPaidByYear: Map<year, number>` reset mỗi năm  
  File: `leave-balance.service.ts`, ANNUAL branch (~line 560–600)

- [ ] **[P1-2]** Bỏ skip UNPAID trong `reserveBalanceForSubmit` → tạo DEBIT RESERVE cho tất cả allocations  
  File: `leave-balance.service.ts`, `reserveBalanceForSubmit()` (~line 890)

- [ ] **[P1-3]** PARENTAL: bỏ `monthlyBuckets = []` → gọi `splitLeaveDaysByMonth` cho tất cả  
  File: `leave-balance.service.ts`, isParentalLeave branch (~line 420)

- [ ] **[P1-4]** POLICY/SOCIAL excess: thêm per-month balance check (thay vì aggregate `endYear/endMonth`)  
  File: `leave-balance.service.ts`, POLICY/SOCIAL branch (~line 500–540)

- [ ] **[P1-5]** Thêm guard `validateAllocationsNoDuplicateBucket()` trước khi save items  
  File: `leave-requests.service.ts`

- [ ] **[P1-6]** Thêm guard `assertAllocationSum()` trong `validateAndPrepare`  
  File: `leave-balance.service.ts`

### Phase 2 — Loại bỏ double-call và unify items/allocations (~2-3 ngày)

- [ ] **[P2-1]** Tạo `allocation.types.ts` với `BucketAllocation`, `AllocationResult` interfaces

- [ ] **[P2-2]** Loại bỏ `items: ConversionItem[]` khỏi `LeaveValidationResult`  
  Thay bằng `allocations: BucketAllocation[]` + `summary: { leaveTypeCode, totalDays }[]`

- [ ] **[P2-3]** Cập nhật `createLeaveRequest` để dùng `locked.allocations` trực tiếp cho items save  
  Xóa `if monthlyAllocations.length > 0 else if items.length > 0` fallback

- [ ] **[P2-4]** Pre-compute lock keys từ preview, acquire tất cả trước re-compute  
  Xóa 3rd `validateAndPrepare` call hiện tại

- [ ] **[P2-5]** Thêm `allocationChanged()` conflict detection

### Phase 3 — Service decomposition (~3-5 ngày)

- [ ] **[P3-1]** Tách `BalanceLedgerService` với `getBalance()`, `getUnpaidBalance()`, `getUsedDays()`, `writeReserveTransactions()`

- [ ] **[P3-2]** Tạo `annual-processor.ts` với `processAnnualBuckets()`

- [ ] **[P3-3]** Tạo `policy-social-processor.ts` với `processPolicySocialBuckets()`

- [ ] **[P3-4]** Tạo `parental-processor.ts` với `processParentalBuckets()`

- [ ] **[P3-5]** Tạo `AllocationService` với `preview()` và `lockAndReserve()`

- [ ] **[P3-6]** Cập nhật `LeaveRequestsService` dùng `AllocationService` thay direct calls

- [ ] **[P3-7]** Mark `LeaveBalanceService.validateAndPrepare()` deprecated, delegate sang `AllocationService`

### Phase 4 — Tests (~2-3 ngày)

- [ ] **[T1]** Unit test `processAnnualBuckets`: cross-month same year, cross-year, zero balance, partial balance
- [ ] **[T2]** Unit test `processPolicySocialBuckets`: within limit, exceed limit, exceed + no paid balance
- [ ] **[T3]** Unit test `processParentalBuckets`: female standard, female excess, male normal, male c-section
- [ ] **[T4]** Unit test `validateAllocationsNoDuplicateBucket`, `assertAllocationSum`
- [ ] **[T5]** Integration test: `createLeaveRequest` ANNUAL cross-year flow
- [ ] **[T6]** Concurrency test: 2 concurrent requests same employee, advisory lock serialize
- [ ] **[T7]** Monthly report query test: ANNUAL cross-month, PARENTAL multi-month
- [ ] **[T8]** Verify backward compat: cũ request items vẫn load đúng sau migration

---

## 12. API contract thay đổi

### 12.1 Warning response (Phase 1 có thể làm ngay)

**Trước:**
```json
{
  "requiresConfirmation": true,
  "warnings": ["..."],
  "durationDays": 5,
  "items": [
    { "leaveTypeCode": "PAID", "amountDays": 3 },
    { "leaveTypeCode": "UNPAID", "amountDays": 2 }
  ]
}
```

**Sau:**
```json
{
  "requiresConfirmation": true,
  "isPreview": true,
  "warnings": ["..."],
  "durationDays": 5,
  "summary": [
    { "leaveTypeCode": "PAID",   "totalDays": 3 },
    { "leaveTypeCode": "UNPAID", "totalDays": 2 }
  ],
  "allocations": [
    { "year": 2026, "month": 11, "leaveTypeCode": "PAID",   "amountDays": 2 },
    { "year": 2026, "month": 12, "leaveTypeCode": "PAID",   "amountDays": 1 },
    { "year": 2026, "month": 12, "leaveTypeCode": "UNPAID", "amountDays": 2 }
  ]
}
```

> Frontend có thể hiển thị `summary` cho user và `allocations` cho detail panel.

### 12.2 Không thay đổi request DTO

`CreateLeaveRequestDto` giữ nguyên, kể cả `confirmDespiteWarning`.

### 12.3 `GET /leave-balance/summary` thêm unpaid

```json
{
  "leaveTypes": [
    { "code": "PAID",   "balance": 8.5,  "used": 3.5, "accrued": 12 },
    { "code": "UNPAID", "balance": 28.0, "used": 2.0, "limit": 30  }
  ]
}
```

---

## Tóm tắt nguyên tắc cốt lõi

1. **Mỗi bucket (leaveTypeId, year, month) là đơn vị nguyên tử** — không thể chia nhỏ hơn
2. **Balance check diễn ra tại bucket** — dùng balance của đúng năm đó, tháng đó
3. **`runningPaid` reset theo năm** — không borrow giữa năm
4. **Allocations = Items = Balance transactions** — 1-1-1 mapping, không có layer trung gian
5. **UNPAID có DEBIT reserve đầy đủ** — limit check dùng ledger, không phải policy-only
6. **Lock keys sorted deterministic** — không deadlock kể cả xuyên năm, đa loại
7. **Conflict detection** — nếu balance thay đổi giữa preview và commit, trả về 409 thay vì commit sai dữ liệu
