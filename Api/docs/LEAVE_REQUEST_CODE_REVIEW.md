# Code Review: `createLeaveRequest` & Leave Balance System

> **Reviewer:** Code Review Agent  
> **Date:** 2026-03-03  
> **Scope:** `leave-requests.service.ts` → `createLeaveRequest()`, `leave-balance.service.ts` → `validateAndPrepare()` / `reserveBalanceForSubmit()`  
> **Severity levels:** 🔴 Critical · 🟠 Major · 🟡 Minor · 🔵 Info

---

## Mục lục

1. [Tổng quan kiến trúc hiện tại](#1-tổng-quan-kiến-trúc-hiện-tại)
2. [Danh sách vấn đề](#2-danh-sách-vấn-đề)
   - 2.1 [Gọi `validateAndPrepare` hai lần — lãng phí & không nhất quán](#21-gọi-validateandprepare-hai-lần--lãng-phí--không-nhất-quán)
   - 2.2 [Race condition giữa pre-flight và reserve](#22-race-condition-giữa-pre-flight-và-reserve)
   - 2.3 [Hàm `validateAndPrepare` quá lớn (~400 dòng), vi phạm SRP](#23-hàm-validateandprepare-quá-lớn-400-dòng-vi-phạm-srp)
   - 2.4 [Nghỉ xuyên tháng / xuyên năm — balance check sai khi span 2 năm](#24-nghỉ-xuyên-tháng--xuyên-năm--balance-check-sai-khi-span-2-năm)
   - 2.5 [Auto-conversion ANNUAL → UNPAID không per-month chặt chẽ](#25-auto-conversion-annual--unpaid-không-per-month-chặt-chẽ)
   - 2.6 [POLICY/SOCIAL conversion không split per-month](#26-policysocial-conversion-không-split-per-month)
   - 2.7 [N+1 query trong conversion chain](#27-n1-query-trong-conversion-chain)
   - 2.8 [Unpaid leave không được reserve (skip DEBIT)](#28-unpaid-leave-không-được-reserve-skip-debit)
   - 2.9 [Advisory lock chỉ lock theo năm đơn — không an toàn khi xuyên năm](#29-advisory-lock-chỉ-lock-theo-năm-đơn--không-an-toàn-khi-xuyên-năm)
   - 2.10 [`items` vs `monthlyAllocations` mismatch](#210-items-vs-monthlyallocations-mismatch)
   - 2.11 [Parental leave không split per-month](#211-parental-leave-không-split-per-month)
   - 2.12 [`reserveBalanceForSubmit` gọi `validateAndPrepare` lần 3 khi có conversion](#212-reservebalanceforsubmit-gọi-validateandprepare-lần-3-khi-có-conversion)
3. [Giải pháp đề xuất](#3-giải-pháp-đề-xuất)
   - 3.1 [Tách nhỏ hàm — Service Decomposition](#31-tách-nhỏ-hàm--service-decomposition)
   - 3.2 [Loại bỏ double-call, dùng "Dry-run + Commit" pattern](#32-loại-bỏ-double-call-dùng-dry-run--commit-pattern)
   - 3.3 [Per-month conversion chính xác theo lịch thực tế](#33-per-month-conversion-chính-xác-theo-lịch-thực-tế)
   - 3.4 [Advisory lock toàn diện cho xuyên năm](#34-advisory-lock-toàn-diện-cho-xuyên-năm)
   - 3.5 [Batch query thay N+1](#35-batch-query-thay-n1)
   - 3.6 [Reserve cả unpaid leave](#36-reserve-cả-unpaid-leave)
   - 3.7 [Refactor flow tổng thể](#37-refactor-flow-tổng-thể)
4. [Proposed Architecture](#4-proposed-architecture)
5. [Migration Plan](#5-migration-plan)

---

## 1. Tổng quan kiến trúc hiện tại

```
┌─────────────────────────┐
│   LeaveRequestsService  │  (Orchestration)
│  createLeaveRequest()   │
└────────┬────────────────┘
         │
         │ 1. validate input, check overlap
         │ 2. PRE-FLIGHT: validateAndPrepare()  ← lần 1 (ngoài transaction)
         │ 3. warn user nếu cần confirm
         │ 4. BEGIN TRANSACTION
         │    4a. save LeaveRequest
         │    4b. reserveBalanceForSubmit()
         │        ├── acquireBalanceLock()
         │        ├── validateAndPrepare()       ← lần 2 (trong lock)
         │        ├── lock thêm conversion types
         │        └── validateAndPrepare()       ← lần 3 (nếu có conversion!)
         │    4c. save LeaveRequestItems
         │    4d. save notification recipients
         │ 5. COMMIT
         │ 6. enqueue notifications
         │
         ▼
┌─────────────────────────┐
│   LeaveBalanceService   │  (Balance Logic)
│  validateAndPrepare()   │  ~400 lines, handles:
│                         │  - duration calculation
│                         │  - parental logic
│                         │  - ANNUAL per-month split
│                         │  - POLICY/SOCIAL conversion
│                         │  - conversion chain fallback
│                         │  - monthly allocation building
└─────────────────────────┘
```

**Vấn đề cốt lõi:** `validateAndPrepare()` vừa là "kiểm tra có đủ balance không" vừa là "tính toán phân bổ tháng + conversion" — hai concern khác nhau bị gộp chung, dẫn đến phải gọi đi gọi lại nhiều lần.

---

## 2. Danh sách vấn đề

### 2.1 Gọi `validateAndPrepare` hai lần — lãng phí & không nhất quán
🟠 **Major**

**File:** `leave-requests.service.ts`, dòng ~143 và ~180

```typescript
// Lần 1: pre-flight (ngoài transaction)
const preValidation = await this.leaveBalanceService.validateAndPrepare(...);

// ... later inside transaction:
// Lần 2: reserveBalanceForSubmit() gọi lại validateAndPrepare bên trong
const validation = await this.leaveBalanceService.reserveBalanceForSubmit(...);
```

**Vấn đề:**
- Kết quả lần 1 **có thể khác** lần 2 vì không có lock → user thấy warning X nhưng thực tế commit kết quả Y
- Lần 1 query nhiều bảng (leaveType, policy, calendar, balance, conversions) → **lãng phí I/O**
- Nếu giữa lần 1 và lần 2 có người khác submit → balance khác → allocation khác → user confirm warning sai

**Impact:** Dữ liệu warning hiển thị cho user có thể không khớp với dữ liệu thực tế được commit.

---

### 2.2 Race condition giữa pre-flight và reserve
🔴 **Critical**

**Flow nguy hiểm:**
```
User A: preValidation → balance = 5 days, no warning
                                                User B: preValidation → balance = 5 days
User A: reserveBalanceForSubmit → lock → re-validate → balance = 5 → RESERVE 3 days → commit
                                                User B: reserveBalanceForSubmit → lock → re-validate → balance = 2 → khác lần 1!
```

Mặc dù `reserveBalanceForSubmit` có advisory lock và re-validate, **vấn đề là user B đã confirm dựa trên thông tin sai** (pre-flight nói "5 days available" nhưng thực tế lúc commit chỉ còn 2 days → có thể bị quá thêm unpaid).

**Root cause:** Pre-flight chạy **ngoài transaction, ngoài lock** → kết quả là stale data.

---

### 2.3 Hàm `validateAndPrepare` quá lớn (~400 dòng), vi phạm SRP
🟠 **Major**

**File:** `leave-balance.service.ts`, dòng 280–810

Hàm này handle quá nhiều concern:
1. Lookup leave type + policy
2. Duration calculation (incl. parental special logic ~100 lines)
3. Conversion chain resolution (PARENTAL, POLICY/SOCIAL, ANNUAL — mỗi cái ~80 lines)
4. Per-month balance check (ANNUAL)
5. Monthly allocation building (non-ANNUAL waterfall)
6. Warning generation

**Impact:**
- Khó test từng concern độc lập
- Khó maintain — thêm leave type mới phải sửa trong 1 hàm lớn
- Duplicate code giữa PARENTAL và POLICY/SOCIAL conversion chains

---

### 2.4 Nghỉ xuyên tháng / xuyên năm — balance check sai khi span 2 năm
🔴 **Critical**

**Scenario:** Nghỉ từ 2026-12-25 (AM) đến 2027-01-05 (PM) — xuyên năm.

**Vấn đề trong ANNUAL branch:**
```typescript
// monthlyBuckets sẽ có:
// [{ year: 2026, month: 12, days: X }, { year: 2027, month: 1, days: Y }]

// Nhưng getBalance() luôn dùng:
const paidAvailableAtMonth = await this.getBalance(
  employeeId, leaveType.id, bucket.year, excludeRequestId, bucket.month, manager,
);
```

- `getBalance(2026, 12)` → lấy balance tích lũy đến tháng 12/2026 ✅
- `getBalance(2027, 1)` → lấy balance tích lũy đến tháng 1/2027 nhưng `runningPaidUsedByThisRequest` **cộng dồn từ tháng 12/2026** — sai vì đây là year khác, balance reset!

**Code lỗi:**
```typescript
// runningPaidUsedByThisRequest là running total xuyên suốt tất cả buckets
// nhưng getBalance() trả về balance CỦA 1 NĂM cụ thể
const effectiveAvailable = paidAvailableAtMonth - runningPaidUsedByThisRequest;
// ← Khi bucket.year = 2027 nhưng runningPaidUsedByThisRequest chứa cả days đã dùng trong 2026
// → effectiveAvailable bị giảm sai
```

**Impact:** Khi nghỉ xuyên năm, balance tháng 1 năm mới bị trừ thừa → user bị convert sang unpaid khi không cần thiết.

---

### 2.5 Auto-conversion ANNUAL → UNPAID không per-month chặt chẽ
🟠 **Major**

**File:** `leave-balance.service.ts`, ANNUAL branch, dòng ~608–655

Khi paid balance hết ở 1 tháng, phần còn lại chuyển sang UNPAID. Nhưng:

```typescript
// Unpaid check chỉ kiểm tra tổng năm, không per-month:
const existingUnpaidUsed = await this.getUsedDays(employeeId, unpaidType.id, year, ...);
const unpaidLimit = unpaidPolicy?.annualLimitDays;
if (existingUnpaidUsed + totalUnpaid > unpaidLimit) {
  warnings.push(...);
}
```

**Vấn đề:**
1. UNPAID limit check chạy sau khi đã allocate tất cả months → **không thể dừng giữa chừng** nếu limit bị vượt ở tháng thứ N
2. `getUsedDays` query toàn năm trong khi balance model là per-month cumulative → inconsistent
3. Nếu request xuyên năm: `year` chỉ là năm của startDate → unpaid used của năm 2 không được kiểm tra

---

### 2.6 POLICY/SOCIAL conversion không split per-month
🟡 **Minor**

**File:** `leave-balance.service.ts`, dòng 500–560

POLICY/SOCIAL excess → PAID → UNPAID, nhưng balance check dùng:
```typescript
const paidBalance = await this.getBalance(
  employeeId, paidType.id, endYear, excludeRequestId, endMonth, manager,
);
```

Chỉ check balance tại tháng cuối = **aggregate**, không per-month. Nếu request nghỉ từ tháng 3 đến tháng 5 và balance tháng 3 = 0 nhưng tháng 5 có accrual, thì:
- Hiện tại: lấy tổng balance tháng 5 → có thể đủ → allocate hết vào PAID
- Thực tế: tháng 3 không có balance → phải unpaid, tháng 5 mới có paid

**Impact:** Không nghiêm trọng cho POLICY (thường ngắn), nhưng logic thiếu nhất quán với ANNUAL.

---

### 2.7 N+1 query trong conversion chain
🟡 **Minor**

**File:** `leave-balance.service.ts`, conversion resolution

```typescript
const conversions = await this.getConversions(leaveType.id);        // Query 1
for (const conv of conversions) {
  const paidBalance = await this.getBalance(...);                     // Query 2 (per conversion)
  const paidConversions = await this.getConversions(paidType.id);    // Query 3 (nested!)
  for (const paidConv of paidConversions) {
    const unpaidPolicy = await this.getActivePolicy(...);             // Query 4
    const unpaidUsed = await this.getUsedDays(...);                   // Query 5
  }
}
```

Mỗi conversion level thêm 2-3 queries. Worst case: **8-10 queries** chỉ cho conversion chain.
Nhân với 2-3 lần gọi `validateAndPrepare` → **20-30 queries** cho 1 leave request submission.

---

### 2.8 Unpaid leave không được reserve (skip DEBIT)
🟠 **Major**

**File:** `leave-balance.service.ts`, dòng ~890

```typescript
// Skip UNPAID — no quota to hold
const unpaidType = await this.getLeaveTypeByCode('UNPAID');
const unpaidTypeId = unpaidType?.id;

for (const alloc of finalValidation.monthlyAllocations) {
  if (unpaidTypeId && alloc.leaveTypeId === unpaidTypeId) continue; // ← SKIP!
  reserveTxs.push({ ... });
}
```

**Vấn đề:**
- Unpaid leave có `annualLimitDays` (thường 30 ngày/năm) → CẦN track usage
- Khi skip DEBIT cho unpaid, hai request concurrent có thể cùng "dùng" unpaid days mà tổng vượt limit
- `getUsedDays()` chỉ count DEBIT transactions → unpaid request không có DEBIT → `usedDays = 0` luôn → limit check vô nghĩa

**Impact:** Unpaid leave annual limit trở thành **soft warning thay vì hard constraint**.

---

### 2.9 Advisory lock chỉ lock theo năm đơn — không an toàn khi xuyên năm
🟠 **Major**

**File:** `leave-balance.service.ts`, `reserveBalanceForSubmit()`, dòng ~855

```typescript
for (let y = startYear; y <= endYear; y++) {
  await this.acquireBalanceLock(manager, employeeId, leaveTypeId, y);
}
```

Lock key: `pg_advisory_xact_lock(employeeId, leaveTypeId * 10000 + year)`

**Vấn đề:**
- Khi request xuyên năm (2026 → 2027), lock 2 keys **tuần tự** → possible deadlock nếu 2 request cùng employee lock ngược thứ tự
- Lock chỉ cover primary leaveType → conversion types được lock **SAU** validate lần 1 → window nhỏ cho race

**Mitigiation hiện tại:** Lock conversion types sau validate và re-validate. Nhưng vẫn có race window.

---

### 2.10 `items` vs `monthlyAllocations` mismatch
🟡 **Minor**

**File:** `leave-requests.service.ts`, dòng 195–220

```typescript
// Save leave request items with per-month allocation
if (validation.monthlyAllocations.length > 0) {
  const items = validation.monthlyAllocations.map(...);
  await queryRunner.manager.save(items);
} else if (validation.items.length > 0) {
  // Fallback: non-monthly types — use request year/month
  const items = validation.items.map(...);
  await queryRunner.manager.save(items);
}
```

**Vấn đề:**
- `monthlyAllocations` và `items` là hai representation khác nhau của cùng 1 dữ liệu
- Fallback branch dùng `startDate` year/month cho **tất cả** items → nếu request xuyên tháng, items sẽ bị gán sai period
- Entity có unique constraint `['leaveRequestId', 'leaveTypeId', 'periodYear', 'periodMonth']` → nếu 2 items cùng type cùng month → crash

---

### 2.11 Parental leave không split per-month
🟡 **Minor**

**File:** `leave-balance.service.ts`, dòng ~420

```typescript
const monthlyBuckets: MonthlyDuration[] = isParentalLeave
  ? [] // ← EMPTY for parental!
  : await splitLeaveDaysByMonth(...);
```

Parental leave (180+ days) span nhiều tháng nhưng `monthlyBuckets = []` → waterfall builder ở cuối tạo single-month allocation → SAI cho leave kéo dài 6 tháng.

**Impact:** Balance transactions cho parental leave bị gộp vào 1 period → monthly reports sai.

---

### 2.12 `reserveBalanceForSubmit` gọi `validateAndPrepare` lần 3 khi có conversion
🟠 **Major**

**File:** `leave-balance.service.ts`, dòng ~874–895

```typescript
const validation = await this.validateAndPrepare(...);  // Lần 2

const additionalTypeIds = new Set(
  validation.monthlyAllocations.map(a => a.leaveTypeId).filter(id => id !== leaveTypeId),
);

if (additionalTypeIds.size > 0) {
  // Lock thêm conversion types
  for (const typeId of additionalTypeIds) { ... }
  
  // Re-validate AGAIN
  finalValidation = await this.validateAndPrepare(...);  // Lần 3!
}
```

**Tại sao lần 3:**
- Lần 2 chạy chỉ với lock trên primary type
- Kết quả có conversion (thêm UNPAID type)  
- Lock thêm UNPAID type
- Re-validate vì UNPAID balance có thể thay đổi

**Vấn đề:**
- 3 lần gọi cùng 1 hàm nặng (~10 queries mỗi lần)
- Nếu lần 3 ra conversion types khác lần 2 → không re-lock → vẫn unsafe
- Infinite loop potential nếu conversion chain thay đổi giữa các lần

---

## 3. Giải pháp đề xuất

### 3.1 Tách nhỏ hàm — Service Decomposition

Tách `validateAndPrepare` thành các module nhỏ, mỗi cái có 1 responsibility:

```
LeaveBalanceService (current monolith)
  └── validateAndPrepare()  ~400 lines

                    ▼ Refactor thành:

LeaveAllocationService (NEW - orchestrator)
  ├── DurationCalculator         (existing, giữ nguyên)
  ├── LeaveConversionResolver    (NEW)
  ├── MonthlyAllocationBuilder   (NEW)
  └── BalanceLedgerService       (renamed from part of LeaveBalanceService)
```

#### a) `LeaveConversionResolver`
```typescript
// Chỉ lo việc: "Với N ngày nghỉ loại X, cần convert thành những loại nào?"
interface ConversionPlan {
  items: ConversionItem[];          // Aggregated: [{PAID: 5}, {UNPAID: 2}]
  warnings: string[];
}

class LeaveConversionResolver {
  /**
   * Resolve conversion chain cho POLICY/SOCIAL leave.
   * Input: leave type, total days, available balances (pre-fetched)
   * Output: ordered list of (leaveTypeId, days)
   */
  resolvePolicySocial(
    leaveType: LeaveType,
    policy: LeaveTypePolicy,
    totalDays: number,
    balances: Map<number, MonthlyBalance[]>,  // typeId → per-month balances
    conversions: LeaveTypeConversion[],
  ): ConversionPlan;

  /**
   * Resolve conversion cho ANNUAL (per-month granularity).
   */
  resolveAnnual(
    leaveType: LeaveType,
    monthlyBuckets: MonthlyDuration[],
    balances: Map<number, MonthlyBalance[]>,
    conversions: LeaveTypeConversion[],
  ): ConversionPlan;

  /**
   * Resolve conversion cho PARENTAL.
   */
  resolveParental(
    leaveType: LeaveType,
    entitlementDays: number,
    excessDays: number,
    balances: Map<number, MonthlyBalance[]>,
    conversions: LeaveTypeConversion[],
  ): ConversionPlan;
}
```

#### b) `MonthlyAllocationBuilder`
```typescript
// Chỉ lo việc: "Với conversion plan (items) + monthly buckets,
// phân bổ chính xác theo tháng thực tế"
class MonthlyAllocationBuilder {
  /**
   * Build monthly allocations từ conversion items và calendar buckets.
   * Đảm bảo: SUM(allocations.days) === SUM(items.days) cho mỗi leave type
   */
  buildAllocations(
    items: ConversionItem[],
    monthlyBuckets: MonthlyDuration[],
    mode: 'waterfall' | 'proportional',
  ): MonthlyAllocation[];
}
```

#### c) `BalanceLedgerService`
```typescript
// Chỉ lo việc: query và write balance transactions
class BalanceLedgerService {
  /** Batch: lấy balance cho nhiều (type, year, month) cùng lúc */
  async batchGetBalances(
    employeeId: number,
    queries: { leaveTypeId: number; year: number; month: number }[],
    excludeRequestId?: number,
    manager?: EntityManager,
  ): Promise<Map<string, number>>;  // key = `${typeId}-${year}-${month}`

  async createReserveTransactions(...): Promise<void>;
  async releaseReserveTransactions(...): Promise<void>;
  async convertReserveToApproval(...): Promise<void>;
  async createRefundTransactions(...): Promise<void>;
}
```

---

### 3.2 Loại bỏ double-call, dùng "Dry-run + Commit" pattern

**Hiện tại:** 3 lần gọi `validateAndPrepare`.  
**Đề xuất:** 2 phases rõ ràng, mỗi cái gọi 1 lần.

```
Phase 1: DRY-RUN (ngoài TX, cho user xem preview)
  └── calculateAllocation(employeeId, dto)
      - Tính duration, conversion, monthly split
      - Dùng READ COMMITTED isolation (default)
      - Trả về: { items, warnings, durationDays }
      - KHÔNG lock, KHÔNG write
      - Dữ liệu có thể stale → flag rõ: "preview, may change"

Phase 2: COMMIT (trong TX, có lock)
  └── reserveAndCommit(manager, employeeId, dto, leaveRequestId)
      - Acquire ALL locks upfront (primary + known conversion types)
      - Tính toán lại 1 lần duy nhất
      - So sánh với dryRun result:
        - Nếu khác → throw ConflictException("Balance changed, please review")
        - Nếu giống → proceed with DEBIT RESERVE
```

```typescript
// Proposed flow in createLeaveRequest:
async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto) {
  // ... input validation, approver lookup, overlap check ...

  // Phase 1: Dry-run (no lock, no write)
  const preview = await this.allocationService.preview(userId, dto);
  
  if (preview.warnings.length > 0 && !dto.confirmDespiteWarning) {
    throw new AppException(ErrorCode.CONFIRMATION_REQUIRED, { 
      warnings: preview.warnings,
      durationDays: preview.durationDays,
      items: preview.items,
      isPreview: true,  // ← signal to frontend: "this is provisional"
    });
  }

  // Phase 2: Commit (with lock)
  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  
  try {
    const savedRequest = await qr.manager.save(leaveRequestEntity);
    
    // Single atomic call: lock → compute → verify → reserve
    const result = await this.allocationService.lockAndReserve(
      qr.manager,
      userId,
      savedRequest.id,
      dto,
      preview,  // pass preview for comparison
    );
    
    // Save items (result.monthlyAllocations is the single source of truth)
    await this.saveLeaveRequestItems(qr.manager, savedRequest.id, result.monthlyAllocations);
    await this.saveNotificationRecipients(qr.manager, savedRequest.id, dto.ccUserIds, userId);
    
    await qr.commitTransaction();
    return await this.reloadRequest(savedRequest.id);
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
```

**Key change trong `lockAndReserve`:**
```typescript
async lockAndReserve(
  manager: EntityManager,
  employeeId: number,
  requestId: number,
  dto: CreateLeaveRequestDto,
  preview: AllocationPreview,
): Promise<AllocationResult> {
  // 1. Determine ALL lock keys upfront
  //    Primary type + known conversion targets (from preview)
  const lockKeys = this.determineLockKeys(dto.leaveTypeId, preview.items);
  
  // 2. Acquire locks in DETERMINISTIC ORDER (sorted by key) → no deadlock
  for (const key of lockKeys.sort()) {
    await this.ledger.acquireLock(manager, employeeId, key.typeId, key.year);
  }
  
  // 3. Single computation under lock
  const result = await this.computeAllocation(manager, employeeId, dto);
  
  // 4. Verify result matches preview  
  //    (nếu balance thay đổi giữa preview và commit)
  if (!this.allocationMatchesPreview(result, preview)) {
    throw new ConflictException(
      'Balance has changed since your preview. Please review the updated allocation.'
    );
  }
  
  // 5. Write DEBIT RESERVE transactions (including UNPAID!)
  await this.ledger.createReserveTransactions(manager, employeeId, requestId, result);
  
  return result;
}
```

---

### 3.3 Per-month conversion chính xác theo lịch thực tế

**Principle:** Mỗi tháng trong request range phải được xử lý **độc lập** — check balance CỦA THÁNG ĐÓ, convert CỦA THÁNG ĐÓ.

#### Cho ANNUAL (đã gần đúng, cần fix xuyên năm):

```typescript
async resolveAnnualPerMonth(
  employeeId: number,
  leaveTypeId: number,
  unpaidTypeId: number,
  monthlyBuckets: MonthlyDuration[],
  excludeRequestId?: number,
  manager?: EntityManager,
): Promise<MonthlyAllocation[]> {
  const allocations: MonthlyAllocation[] = [];
  
  // Track running usage PER YEAR (reset khi sang năm mới)
  const runningUsedByYear = new Map<number, number>();
  
  for (const bucket of monthlyBuckets) {
    const { year, month, durationDays: needDays } = bucket;
    
    // Get running used for THIS year
    const runningUsed = runningUsedByYear.get(year) ?? 0;
    
    // Balance tích lũy tại (year, month) — trừ running used trong cùng request
    const paidAvailable = await this.ledger.getBalance(
      employeeId, leaveTypeId, year, excludeRequestId, month, manager,
    );
    const effectiveAvailable = Math.max(paidAvailable - runningUsed, 0);
    
    const paidDays = Math.min(needDays, effectiveAvailable);
    const unpaidDays = needDays - paidDays;
    
    if (paidDays > 0) {
      allocations.push({
        year, month, leaveTypeId, leaveTypeCode: 'PAID',
        amountDays: paidDays,
        note: `Paid leave (${year}/${String(month).padStart(2, '0')})`,
      });
      // Update running for THIS year only
      runningUsedByYear.set(year, runningUsed + paidDays);
    }
    
    if (unpaidDays > 0) {
      allocations.push({
        year, month, leaveTypeId: unpaidTypeId, leaveTypeCode: 'UNPAID',
        amountDays: unpaidDays,
        note: `Unpaid leave (${year}/${String(month).padStart(2, '0')})`,
      });
    }
  }
  
  return allocations;
}
```

**Key fix:** `runningUsedByYear` reset khi sang năm mới, thay vì dùng 1 biến `runningPaidUsedByThisRequest` xuyên suốt.

#### Cho POLICY / SOCIAL (cần thêm per-month logic):

```typescript
async resolvePolicySocialPerMonth(
  employeeId: number,
  leaveType: LeaveType,
  policy: LeaveTypePolicy,
  monthlyBuckets: MonthlyDuration[],
  conversions: LeaveTypeConversion[],
  excludeRequestId?: number,
  manager?: EntityManager,
): Promise<{ allocations: MonthlyAllocation[]; warnings: string[] }> {
  const allocations: MonthlyAllocation[] = [];
  const warnings: string[] = [];
  
  const maxPerRequest = policy?.maxPerRequestDays ? Number(policy.maxPerRequestDays) : Infinity;
  let entitlementRemaining = maxPerRequest;
  
  // Phase 1: Allocate entitlement (policy type) across months — waterfall
  for (const bucket of monthlyBuckets) {
    if (entitlementRemaining <= 0) break;
    const take = Math.min(bucket.durationDays, entitlementRemaining);
    if (take > 0) {
      allocations.push({
        year: bucket.year, month: bucket.month,
        leaveTypeId: leaveType.id, leaveTypeCode: leaveType.code,
        amountDays: take,
        note: `${leaveType.name} entitlement`,
      });
      entitlementRemaining -= take;
    }
  }
  
  // Phase 2: Excess → PAID → UNPAID, per-month
  const excessBuckets = this.getExcessBuckets(monthlyBuckets, allocations);
  
  if (excessBuckets.length > 0) {
    const exceedConv = conversions.find(c => c.reason === 'EXCEED_MAX_PER_REQUEST');
    if (exceedConv) {
      const paidType = exceedConv.toLeaveType;
      const runningUsedByYear = new Map<number, number>();
      
      for (const excess of excessBuckets) {
        const { year, month, durationDays: needDays } = excess;
        const runningUsed = runningUsedByYear.get(year) ?? 0;
        const paidAvailable = await this.ledger.getBalance(
          employeeId, paidType.id, year, excludeRequestId, month, manager,
        );
        const effectiveAvailable = Math.max(paidAvailable - runningUsed, 0);
        const paidDays = Math.min(needDays, effectiveAvailable);
        const unpaidDays = needDays - paidDays;
        
        if (paidDays > 0) {
          allocations.push({
            year, month, leaveTypeId: paidType.id, leaveTypeCode: paidType.code,
            amountDays: paidDays, note: `Excess → ${paidType.name}`,
          });
          runningUsedByYear.set(year, runningUsed + paidDays);
        }
        
        if (unpaidDays > 0) {
          // Resolve PAID → UNPAID conversion for this month
          // ... similar pattern
        }
      }
    }
  }
  
  return { allocations, warnings };
}
```

---

### 3.4 Advisory lock toàn diện cho xuyên năm

```typescript
/**
 * Acquire locks cho TẤT CẢ (type, year) combinations cần thiết.
 * Sort keys deterministically để tránh deadlock.
 */
async acquireAllLocks(
  manager: EntityManager,
  employeeId: number,
  lockKeys: { typeId: number; year: number }[],
): Promise<void> {
  // Deterministic order: sort by typeId ASC, then year ASC
  const sorted = [...lockKeys].sort((a, b) => 
    a.typeId !== b.typeId ? a.typeId - b.typeId : a.year - b.year
  );
  
  // Deduplicate
  const seen = new Set<string>();
  for (const key of sorted) {
    const k = `${key.typeId}-${key.year}`;
    if (seen.has(k)) continue;
    seen.add(k);
    await this.acquireBalanceLock(manager, employeeId, key.typeId, key.year);
  }
}
```

**Pre-compute lock keys TRƯỚC khi acquire:**

```typescript
function determineLockKeys(
  primaryTypeId: number,
  startDate: string,
  endDate: string,
  previewItems: ConversionItem[],
): { typeId: number; year: number }[] {
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate + 'T00:00:00').getFullYear();
  const keys: { typeId: number; year: number }[] = [];
  
  // Primary type for all years
  for (let y = startYear; y <= endYear; y++) {
    keys.push({ typeId: primaryTypeId, year: y });
  }
  
  // Conversion types from preview (conservative: lock all years)
  const convTypeIds = new Set(previewItems.map(i => i.leaveTypeId).filter(id => id !== primaryTypeId));
  for (const typeId of convTypeIds) {
    for (let y = startYear; y <= endYear; y++) {
      keys.push({ typeId, year: y });
    }
  }
  
  return keys;
}
```

---

### 3.5 Batch query thay N+1

```typescript
/**
 * Single query lấy balance cho nhiều (type, year, month) combinations.
 * Thay vì gọi getBalance() N lần.
 */
async batchGetBalances(
  employeeId: number,
  queries: { leaveTypeId: number; year: number; month: number }[],
  excludeRequestId?: number,
  manager?: EntityManager,
): Promise<Map<string, number>> {
  const repo = manager?.getRepository(LeaveBalanceTransaction) ?? this.balanceTxRepo;
  
  // Build single query with CASE/GROUP BY
  // 
  // SELECT leave_type_id, period_year, 
  //   SUM(CASE WHEN direction='CREDIT' THEN amount_days ELSE 0 END) as credits,
  //   SUM(CASE WHEN direction='DEBIT' AND (source_id IS NULL OR source_id != :exclude) 
  //       THEN amount_days ELSE 0 END) as debits
  // FROM leave_balance_transactions
  // WHERE employee_id = :empId
  //   AND (leave_type_id, period_year) IN (...)
  // GROUP BY leave_type_id, period_year, period_month
  // ORDER BY leave_type_id, period_year, period_month
  
  // Then compute cumulative balance per (type, year) up to each month
  
  const result = new Map<string, number>();
  // ... implementation
  return result;  // key = `${typeId}-${year}-${month}`
}
```

Cũng batch fetch conversions và policies:

```typescript
/**
 * Pre-fetch tất cả conversion rules và policies cần thiết.
 */
async prefetchConversionContext(
  primaryTypeId: number,
  startDate: string,
): Promise<ConversionContext> {
  // 1. Get primary type + policy
  const [leaveType, policy] = await Promise.all([
    this.getLeaveTypeById(primaryTypeId),
    this.getActivePolicy(primaryTypeId, startDate),
  ]);
  
  // 2. Get all conversions from primary type
  const conversions = await this.getConversions(primaryTypeId);
  
  // 3. Get secondary types + their conversions + policies in parallel
  const secondaryTypeIds = conversions.map(c => c.toLeaveTypeId);
  const [secondaryConversions, secondaryPolicies] = await Promise.all([
    Promise.all(secondaryTypeIds.map(id => this.getConversions(id))),
    Promise.all(secondaryTypeIds.map(id => this.getActivePolicy(id, startDate))),
  ]);
  
  return { leaveType, policy, conversions, secondaryConversions, secondaryPolicies };
}
```

---

### 3.6 Reserve cả unpaid leave

```typescript
// Trong reserveBalanceForSubmit — BỎ skip UNPAID:
for (const alloc of finalValidation.monthlyAllocations) {
  // KHÔNG skip unpaid nữa — track tất cả
  reserveTxs.push({
    employeeId,
    leaveTypeId: alloc.leaveTypeId,
    periodYear: alloc.year,
    periodMonth: alloc.month,
    direction: BalanceTxDirection.DEBIT,
    amountDays: alloc.amountDays,
    sourceType: BalanceTxSource.RESERVE,
    sourceId: leaveRequestId,
    note: `Leave #${leaveRequestId} reserve – ${alloc.year}/${alloc.month} (${alloc.leaveTypeCode})`,
  });
}
```

**Yêu cầu thêm:** Cần seed unpaid balance (hoặc dùng limit-based check thay vì balance-based):

```typescript
// Option A: Seed unpaid balance hàng năm (giống paid)
// initializeYearlyBalance → tạo 30 CREDIT cho UNPAID

// Option B (recommended): Dùng limit check khi getBalance cho UNPAID
// getBalance cho UNPAID = limit - SUM(DEBIT) + SUM(CREDIT RELEASE/REFUND)
// Không cần seed, vì limit là policy-based
```

---

### 3.7 Refactor flow tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                   createLeaveRequest                         │
│                                                              │
│  1. validateInput(dto)                         [pure]       │
│  2. lookupApprover(userId)                     [query]      │
│  3. checkOverlap(userId, dates)                [query]      │
│  4. preview = allocationService.preview(dto)   [query only] │
│     ├── calculateDuration()                                  │
│     ├── prefetchConversionContext()                          │
│     ├── splitByMonth()                                       │
│     ├── resolveConversion(perMonth)                          │
│     └── buildAllocations()                                   │
│                                                              │
│  5. if warnings && !confirmed → return warnings              │
│                                                              │
│  6. BEGIN TRANSACTION                                        │
│  7. result = allocationService.lockAndReserve()              │
│     ├── acquireAllLocks(sorted, deduped)                    │
│     ├── recompute() — single call                           │
│     ├── verify(result, preview)                             │
│     └── writeReserveTransactions()                          │
│  8. saveLeaveRequest(result)                                │
│  9. saveItems(result.monthlyAllocations)                    │
│ 10. saveNotificationRecipients()                            │
│ 11. COMMIT                                                   │
│ 12. enqueueNotifications()                                   │
└─────────────────────────────────────────────────────────────┘
```

**So sánh:**

| Aspect | Hiện tại | Đề xuất |
|--------|---------|---------|
| `validateAndPrepare` calls | 2-3 | 2 (preview + commit), guaranteed |
| Queries per submission | ~30-40 | ~12-15 (batched) |
| Lock ordering | Sequential, ad-hoc | Deterministic, sorted → no deadlock |
| Cross-year handling | Bug (shared running counter) | Reset per year |
| Unpaid tracking | Skip DEBIT | Full DEBIT RESERVE |
| Monthly split for POLICY | Aggregate → waterfall post-hoc | Per-month at conversion time |
| Parental monthly split | None (empty buckets) | Calendar-based split |
| Code organization | 1 monolith function | 4 focused classes |

---

## 4. Proposed Architecture

```
src/modules/leave-requests/
├── leave-requests.service.ts          ← Orchestrator (thin)
├── leave-requests.controller.ts
├── dto/
│   ├── create-leave-request.dto.ts
│   └── update-leave-request.dto.ts
│
├── allocation/                         ← NEW module
│   ├── allocation.service.ts          ← preview() + lockAndReserve()
│   ├── conversion-resolver.ts         ← resolveAnnual(), resolvePolicySocial(), resolveParental()
│   ├── monthly-allocation-builder.ts  ← buildAllocations()
│   └── allocation.types.ts            ← interfaces
│
├── balance/                            ← Extracted from leave-balance
│   ├── balance-ledger.service.ts      ← getBalance(), batchGet(), reserve(), release()
│   ├── balance-accrual.service.ts     ← monthly accrual, yearly init
│   └── balance-summary.service.ts     ← reports, employee summary
│
├── utils/
│   └── duration-calculator.ts         ← Existing (no change)
│
└── leave-balance.service.ts           ← DEPRECATED, delegate to new services
```

---

## 5. Migration Plan

### Phase 1: Fix Critical Bugs (1-2 days)
- [ ] Fix cross-year `runningPaidUsedByThisRequest` → reset per year
- [ ] Reserve UNPAID leave transactions (remove skip)
- [ ] Fix parental leave empty `monthlyBuckets` → use calendar split

### Phase 2: Reduce Duplicate Calls (2-3 days)  
- [ ] Extract `prefetchConversionContext()` → batch queries
- [ ] Make `reserveBalanceForSubmit` accept pre-computed lock keys
- [ ] Eliminate 3rd `validateAndPrepare` call by locking all types upfront

### Phase 3: Service Decomposition (3-5 days)
- [ ] Extract `ConversionResolver` class
- [ ] Extract `MonthlyAllocationBuilder` class
- [ ] Extract `BalanceLedgerService` with batch query support
- [ ] Create `AllocationService` as orchestrator
- [ ] Update `LeaveRequestsService` to use new services

### Phase 4: Testing & Verification (2-3 days)
- [ ] Unit tests for `ConversionResolver` (each category)
- [ ] Integration tests for cross-month / cross-year scenarios
- [ ] Concurrency tests (parallel submissions same employee)
- [ ] Migration compatibility (existing data works with new flow)

---

> **Tổng estimate:** ~8-13 days  
> **Priority:** Phase 1 (critical bugs) → Phase 2 (performance) → Phase 3 (architecture) → Phase 4 (quality)
