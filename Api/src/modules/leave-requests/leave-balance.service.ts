
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { LeaveBalanceTransaction } from '@entities/leave-balance-transaction.entity';
import { LeaveType } from '@entities/leave-type.entity';
import { LeaveTypePolicy } from '@entities/leave-type-policy.entity';
import { LeaveTypeConversion } from '@entities/leave-type-conversion.entity';
import { LeaveRequestItem } from '@entities/leave-request-item.entity';
import { LeaveTypes } from '@/common/enums/leave_type.enum';
import { CalendarOverride } from '@entities/calendar-override.entity';
import { User } from '@entities/users.entity';
import { UserStatus } from '@/common/enums/user-status.enum';
import { calculateLeaveDuration, autoCalculateEndDate, calculateCalendarDuration, calculateCalendarEndDate, splitLeaveDaysByMonth, splitCalendarDaysByMonth, MonthlyDuration } from './utils/duration-calculator';
import { LeaveSession } from '@/common/enums/leave-session.enum';
import { ChildbirthMethod } from '@/common/enums/childbirth-method.enum';
import { UserGender } from '@/common/enums/user-genders';
import { BalanceTxDirection } from '@/common/enums/balance-tx-direction.enum';
import { BalanceTxSource } from '@/common/enums/balance-tx-source.enum';
import { validateAllocationsNoDuplicateBucket, assertAllocationSum } from './utils/allocation-validator';
import { LeaveCategory } from '@/common/enums/leave-category.enum';
import { BALANCE_TYPE_CODES } from '@/common/enums/balance_leavetype.enum';

export interface BalanceInfo {
  leaveTypeId: number;
  leaveTypeCode: string;
  balance: number; // in days
}

export interface ConversionItem {
  leaveTypeId: number;
  leaveTypeCode: string;
  amountDays: number;
  note: string;
}

/**
 * Per-month allocation detail used for transaction recording.
 * Each entry represents days of a specific leave type consumed in a specific month.
 */
export interface MonthlyAllocation {
  year: number;
  month: number; // 1-12
  leaveTypeId: number;
  leaveTypeCode: string;
  amountDays: number;
  note: string;
}

export interface LeaveValidationResult {
  /** Total duration in days */
  durationDays: number;
  /** Breakdown of leave type items (after conversion) — aggregated summary */
  items: ConversionItem[];
  /** Per-month allocation detail — used by reserve/debit/refund */
  monthlyAllocations: MonthlyAllocation[];
  /** Warnings to display to user */
  warnings: string[];
  /** Whether the request can proceed */
  canProceed: boolean;
}

@Injectable()
export class LeaveBalanceService {
  private readonly logger = new Logger(LeaveBalanceService.name);

  constructor(
    @InjectRepository(LeaveBalanceTransaction)
    private balanceTxRepo: Repository<LeaveBalanceTransaction>,
    @InjectRepository(LeaveType)
    private leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveTypePolicy)
    private policyRepo: Repository<LeaveTypePolicy>,
    @InjectRepository(LeaveTypeConversion)
    private conversionRepo: Repository<LeaveTypeConversion>,
    @InjectRepository(CalendarOverride)
    private calendarRepo: Repository<CalendarOverride>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(LeaveRequestItem)
    private leaveRequestItemRepo: Repository<LeaveRequestItem>,
    private dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // Advisory Lock
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Acquire a PostgreSQL advisory transaction lock for a specific
   * (employee, leaveType, year) combination.
   *
   * The lock is automatically released when the transaction commits/rolls back.
   * Two concurrent submits for the same employee+type+year will serialise here.
   */
  private async acquireBalanceLock(
    manager: EntityManager,
    employeeId: number,
    leaveTypeId: number,
    periodYear: number,
  ): Promise<void> {
    // key1 = employeeId, key2 = leaveTypeId * 10000 + periodYear
    const key1 = employeeId;
    const key2 = Number(leaveTypeId) * 10000 + periodYear;
    await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [key1, key2]);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Balance Query — Pure Ledger (no pending item scanning)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get available balance for (employee, leaveType, year) up to a given month.
   *
   * Balance = cumulative CREDIT(1-> atMonth) − cumulative DEBIT (includes RESERVE rows, 1 -> 12)  
   *   
   * 
   *
   * @param manager   Optional EntityManager to run inside an existing transaction
   *                  (required when called under advisory lock).
   * @param excludeRequestId  Exclude RESERVE/APPROVAL debits for this request
   *                          (used during update to "un-count" the old request).
   */
  async getBalance(
    employeeId: number,
    leaveTypeId: number,
    year: number,
    excludeRequestId?: number,
    atMonth?: number,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(LeaveBalanceTransaction)
      : this.balanceTxRepo;

    // --- MONTHLY_ACCRUAL credits: only count up to atMonth ---
    // Accrual is earned incrementally each month, so we cap it at the current
    // month to avoid counting future accrual that hasn't been earned yet.
    let accrualQb = repo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
      .where('tx.employee_id = :employeeId', { employeeId })
      .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('tx.period_year = :year', { year })
      .andWhere("tx.direction = 'CREDIT'")
      .andWhere("tx.source_type = 'MONTHLY_ACCRUAL'");
    if (atMonth) {
      accrualQb = accrualQb.andWhere('tx.period_month <= :atMonth', { atMonth });
    }
    const accrualResult = await accrualQb.getRawOne();
    const accrualCredit = parseFloat(accrualResult?.total ?? '0');

    // --- Other credits (REFUND, RELEASE, ADJUSTMENT, etc.): full year ---
    // Non-accrual credits (e.g. refunds, manual adjustments) are always
    // fully counted regardless of the month being checked.
    const otherCreditResult = await repo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
      .where('tx.employee_id = :employeeId', { employeeId })
      .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('tx.period_year = :year', { year })
      .andWhere("tx.direction = 'CREDIT'")
      .andWhere("tx.source_type != 'MONTHLY_ACCRUAL'")
      .getRawOne();
    const otherCredit = parseFloat(otherCreditResult?.total ?? '0');

    const totalCredit = accrualCredit + otherCredit;

    // --- debit total for the year (no month filter) ---
    // All debits (RESERVE, APPROVAL) for the entire year are summed so that
    // commitments at later months are always visible when checking an earlier
    // month.  Without this, booking leave at month 3 would ignore a 5-day
    // debit already committed at month 10.
    let debitQb = repo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
      .where('tx.employee_id = :employeeId', { employeeId })
      .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('tx.period_year = :year', { year })
      .andWhere("tx.direction = 'DEBIT'");
    

    /// check lại balance
    if (excludeRequestId) {
      debitQb = debitQb.andWhere(
        '(tx.source_id IS NULL OR tx.source_id != :excludeRequestId)',
        { excludeRequestId },
      );
    }

    const debitResult = await debitQb.getRawOne();
    const totalDebit = parseFloat(debitResult?.total ?? '0');

    return totalCredit - totalDebit;
  }

  /**
   * Get active policy for a leave type at a given date
   */
  async getActivePolicy(leaveTypeId: number, atDate: string): Promise<LeaveTypePolicy | null> {
    return this.policyRepo
      .createQueryBuilder('p')
      .where('p.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('p.effective_from <= :atDate', { atDate })
      .andWhere('(p.effective_to IS NULL OR p.effective_to >= :atDate)', { atDate })
      .orderBy('p.effective_from', 'DESC')
      .getOne();
  }

  /**
   * Get conversion rules for a leave type (ordered by priority)
   */
  async getConversions(fromLeaveTypeId: number): Promise<LeaveTypeConversion[]> {
    return this.conversionRepo.find({
      where: { fromLeaveTypeId, isActive: true },
      relations: ['toLeaveType'],
      order: { priority: 'ASC' },
    });
  }

  /**
   * Get leave type by code
   */
  async getLeaveTypeByCode(code: string): Promise<LeaveType | null> {
    return this.leaveTypeRepo.findOne({
      where: { code, isActive: true },
      relations: ['category'],
    });
  }

  /**
   * Get leave type by id
   */
  async getLeaveTypeById(id: number): Promise<LeaveType | null> {
    return this.leaveTypeRepo.findOne({
      where: { id, isActive: true },
      relations: ['category'],
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Validate & Prepare (core allocation logic)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Main validation + conversion logic for a leave request submission.
   *
   * Flow:
   * 1. Lookup leave type + active policy
   * 2. Calculate duration from user-provided dates
   * 3. Split request by calendar months → needByPeriod[(year, month)]
   * 4. If non-ANNUAL + has M (comp) conversion → allocate M first per period
   * 5. For ANNUAL: check paid balance per month (no borrow) → overflow to UNPAID
   * 6. Return items + monthlyAllocations
   *
   * @param manager  Optional entity manager (for running inside tx with lock)
   */
  async validateAndPrepare(
    employeeId: number,
    leaveTypeId: number,
    startDate: string,
    endDate: string,
    startSession: LeaveSession,
    endSession: LeaveSession,
    excludeRequestId?: number,
    parentalOptions?: {
      numberOfChildren?: number;
      childbirthMethod?: ChildbirthMethod;
    },
    manager?: EntityManager,
  ): Promise<LeaveValidationResult> {
    const leaveType = await this.getLeaveTypeById(leaveTypeId);
    if (!leaveType) {
      throw new Error(`Leave type ${leaveTypeId} not found or inactive`);
    }

    const policy = await this.getActivePolicy(leaveTypeId, startDate);
    const startyear = new Date(startDate).getFullYear();
    const categoryCode = leaveType.category?.code ?? '';

    const warnings: string[] = [];
    const finalEndDate = endDate;
    const finalEndSession = endSession;

    // ── Step 1: Calculate duration ──────────────────────────
    const isParentalLeave = leaveType.code === LeaveTypes.PARENTAL_LEAVE;
    const user = await this.userRepo.findOne({ where: { id: employeeId } });
    const isFemale = user?.gender === UserGender.FEMALE;
    let durationDays: number;
    let parentalEntitlementDays = 0;
    let excessWorkingDays = 0;
    // Saved for building calendar-day monthly allocations (female parental)
    let maternityEndDateStr: string | undefined;
    let maternityEndSessionVal: LeaveSession | undefined;
    let excessStartStr: string | undefined;
    let excessStartSessionVal: LeaveSession | undefined;

    if (isParentalLeave) {
      

      if (isFemale) {
        const numChildren = parentalOptions?.numberOfChildren ?? 1;
       const start = new Date(startDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 6);   // +6 tháng
      end.setDate(end.getDate() - 1);     // inclusive

      const sixMonthsDays =
        Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      parentalEntitlementDays = sixMonthsDays + Math.max(0, numChildren - 1) * 30;
          
        const calendarDuration = calculateCalendarDuration(
          startDate, finalEndDate, startSession, finalEndSession,
        );

        if (calendarDuration.durationDays <= 0) {
          throw new Error('Leave duration must be at least 0.5 days');
        }

        if (calendarDuration.durationDays <= parentalEntitlementDays) {
          durationDays = calendarDuration.durationDays;
        } else {
          const maternityEnd = calculateCalendarEndDate(
            startDate, startSession, parentalEntitlementDays,
          );
          maternityEndDateStr = maternityEnd.endDate;
          maternityEndSessionVal = maternityEnd.endSession;

          const excessStartDate = new Date(maternityEnd.endDate + 'T00:00:00');
          let excessStartSession: LeaveSession;
          if (maternityEnd.endSession === LeaveSession.PM) {
            excessStartDate.setDate(excessStartDate.getDate() + 1);
            excessStartSession = LeaveSession.AM;
          } else {
            excessStartSession = LeaveSession.PM;
          }

          const fmtDate = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          };

          excessStartStr = fmtDate(excessStartDate);
          excessStartSessionVal = excessStartSession;
          const excessDuration = await calculateLeaveDuration(
            leaveTypeId,
            this.calendarRepo,
            excessStartStr,
            finalEndDate,
            excessStartSession,
            finalEndSession,
          );

          excessWorkingDays = excessDuration.durationDays;
          durationDays = parentalEntitlementDays + excessWorkingDays;
        }
      } else {
        const entitlement =
          parentalOptions?.childbirthMethod === ChildbirthMethod.C_SECTION ? 7 : 5;
        parentalEntitlementDays = entitlement;

        const duration = await calculateLeaveDuration(  
          leaveTypeId,
          this.calendarRepo,
          startDate,
          finalEndDate,
          startSession,
          finalEndSession,
        );

        if (duration.durationDays <= 0) {
          throw new Error('Leave duration must be at least 0.5 days');
        }

        durationDays = duration.durationDays;
        if (durationDays > entitlement) {
          excessWorkingDays = durationDays - entitlement;
        }
      }
    } else {
      const duration = await calculateLeaveDuration(
        leaveTypeId,
        this.calendarRepo,
        startDate,
        finalEndDate,
        startSession,
        finalEndSession,
      );

      if (duration.durationDays <= 0) {
        throw new Error('Leave duration must be at least 0.5 days');
      }

      durationDays = duration.durationDays;
    }

    // Check min duration
    if (policy?.minDurationDays && durationDays < Number(policy.minDurationDays)) {
      throw new Error(
        `Minimum leave duration for ${leaveType.name} is ${policy.minDurationDays} days`,
      );
    }
    console.log(`Calculated duration: ${durationDays} days (parental entitlement: ${parentalEntitlementDays} days, excess working days: ${excessWorkingDays} days)`);

    // ── Step 2: Build items with conversion logic ───────────
    const items: ConversionItem[] = [];
    const monthlyAllocations: MonthlyAllocation[] = [];
    let remainingDays = durationDays;

    const endDateObj = new Date(endDate + 'T00:00:00');
    const endYear = endDateObj.getFullYear();
    const endMonth = endDateObj.getMonth() + 1;

    // Pre-compute monthly duration split (always compute, including PARENTAL)
    const monthlyBuckets: MonthlyDuration[] = await splitLeaveDaysByMonth(
          leaveTypeId,
        //  isParentalLeave,
        //  isFemale,
          this.calendarRepo,
          startDate,
          endDate,
          startSession,
          endSession,
        );

    // 2a. PARENTAL leave
    if (isParentalLeave) {
      const coveredDays = durationDays - excessWorkingDays;
      items.push({
        leaveTypeId: leaveType.id,
        leaveTypeCode: leaveType.code,
        amountDays: coveredDays,
        note: `${leaveType.name} (maternity/paternity entitlement)`,
      });
      remainingDays = excessWorkingDays;

      if (remainingDays > 0) {
        const conversions = await this.getConversions(leaveType.id);
        for (const conv of conversions) {
          if (conv.reason !== 'EXCEED_MAX_PER_REQUEST' || remainingDays <= 0) continue;

          const paidType = conv.toLeaveType;
          const paidBalance = await this.getBalance(
            employeeId, paidType.id, endYear, excludeRequestId, endMonth, manager,
          );
          const fromPaid = Math.min(remainingDays, Math.max(paidBalance, 0));

          if (fromPaid > 0) {
            items.push({
              leaveTypeId: paidType.id,
              leaveTypeCode: paidType.code,
              amountDays: fromPaid,
              note: `Excess from ${leaveType.name} → ${paidType.name}`,
            });
            remainingDays -= fromPaid;
          }

          if (remainingDays > 0) {
            warnings.push(
              `Your paid leave balance (${paidBalance} days) is insufficient to cover the excess. ${remainingDays} days will be deducted as unpaid leave.`,
            );
          }

          // PAID → UNPAID chain
          if (remainingDays > 0) {
            const paidConversions = await this.getConversions(paidType.id);
            for (const paidConv of paidConversions) {
              if (paidConv.reason !== 'EXCEED_BALANCE' || remainingDays <= 0) continue;
              const unpaidType = paidConv.toLeaveType;
              const unpaidPolicy = await this.getActivePolicy(unpaidType.id, startDate);
              const unpaidUsed = await this.getUsedDays(employeeId, unpaidType.id, startyear, excludeRequestId, manager);
              const unpaidLimit = unpaidPolicy?.annualLimitDays ? Number(unpaidPolicy.annualLimitDays) : Infinity;
              const unpaidAvailable = Math.max(unpaidLimit - unpaidUsed, 0);
              const fromUnpaid = Math.min(remainingDays, unpaidAvailable);

              if (fromUnpaid > 0) {
                items.push({
                  leaveTypeId: unpaidType.id,
                  leaveTypeCode: unpaidType.code,
                  amountDays: fromUnpaid,
                  note: `Excess from ${leaveType.name} → ${unpaidType.name}`,
                });
                remainingDays -= fromUnpaid;
              }

              if (remainingDays > 0) {
                warnings.push(
                  `Unpaid leave limit (${unpaidLimit} days/year) may be exceeded. ${unpaidUsed} days already used this year.`,
                );
              }
            }
          }
        }
      }

      // ── Build monthlyAllocations for female parental (calendar-day buckets) ──
      if (isFemale) {
        // Entitlement portion: calendar-day buckets (no weekend/holiday skip)
        const entitlementEnd = maternityEndDateStr ?? finalEndDate;
        const entitlementEndSess = maternityEndSessionVal ?? finalEndSession;
        const calendarBuckets = splitCalendarDaysByMonth(
          startDate, entitlementEnd, startSession, entitlementEndSess,
        );

        // Waterfall fill coveredDays into calendar-day buckets
        let coveredLeft = coveredDays;
        for (const bucket of calendarBuckets) {
          const take = Math.round(Math.min(bucket.durationDays, coveredLeft) * 2) / 2;
          if (take > 0) {
            monthlyAllocations.push({
              year: bucket.year,
              month: bucket.month,
              leaveTypeId: leaveType.id,
              leaveTypeCode: leaveType.code,
              amountDays: take,
              note: `${leaveType.name} (maternity entitlement) (${bucket.year}/${String(bucket.month).padStart(2, '0')})`,
            });
            coveredLeft -= take;
          }
        }

        // Excess portion: working-day buckets (normal skip weekends/holidays)
        if (excessWorkingDays > 0 && excessStartStr && excessStartSessionVal) {
          const excessBuckets = await splitLeaveDaysByMonth(
            leaveTypeId,
            this.calendarRepo,
            excessStartStr,
            finalEndDate,
            excessStartSessionVal,
            finalEndSession,
          );

          const excessCapacities = excessBuckets.map(b => b.durationDays);
          // Waterfall fill excess items (skip the first item which is entitlement)
          for (const item of items.slice(1)) {
            let remaining = item.amountDays;
            for (let i = 0; i < excessBuckets.length && remaining > 0; i++) {
              const canTake = Math.round(Math.min(remaining, excessCapacities[i]) * 2) / 2;
              if (canTake > 0) {
                monthlyAllocations.push({
                  year: excessBuckets[i].year,
                  month: excessBuckets[i].month,
                  leaveTypeId: item.leaveTypeId,
                  leaveTypeCode: item.leaveTypeCode,
                  amountDays: canTake,
                  note: `${item.note} (${excessBuckets[i].year}/${String(excessBuckets[i].month).padStart(2, '0')})`,
                });
                excessCapacities[i] -= canTake;
                remaining -= canTake;
              }
            }

            // Safety: leftover to last bucket
            if (remaining > 0 && excessBuckets.length > 0) {
              const lastBucket = excessBuckets[excessBuckets.length - 1];
              const lastAlloc = monthlyAllocations[monthlyAllocations.length - 1];
              if (
                lastAlloc &&
                lastAlloc.year === lastBucket.year &&
                lastAlloc.month === lastBucket.month &&
                lastAlloc.leaveTypeId === item.leaveTypeId
              ) {
                lastAlloc.amountDays = Math.round((lastAlloc.amountDays + remaining) * 2) / 2;
              } else {
                monthlyAllocations.push({
                  year: lastBucket.year,
                  month: lastBucket.month,
                  leaveTypeId: item.leaveTypeId,
                  leaveTypeCode: item.leaveTypeCode,
                  amountDays: Math.round(remaining * 2) / 2,
                  note: item.note,
                });
              }
            }
          }
        }
      }
    }

    // 2b. POLICY / SOCIAL categories (non-parental)
    //     Per-bucket balance check for excess (no aggregate endYear/endMonth)
    else if (categoryCode === LeaveCategory.POLICY || categoryCode === LeaveCategory.SOCIAL) {
      let entitlementDays: number;

      if (policy?.maxPerRequestDays) {
        const maxDays = Number(policy.maxPerRequestDays);
        entitlementDays = Math.min(remainingDays, maxDays);
        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: entitlementDays,
          note: `${leaveType.name} (policy entitlement)`,
        });
        remainingDays -= entitlementDays;
      } else {
        entitlementDays = remainingDays;
        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: entitlementDays,
          note: leaveType.name,
        });
        remainingDays = 0;
      }

      // Build monthlyAllocations for the entitlement portion (waterfall across buckets)
      let entitlementLeft = entitlementDays;
      for (const bucket of monthlyBuckets) {
        const take = Math.min(bucket.durationDays, entitlementLeft);
        if (take > 0) {
          monthlyAllocations.push({
            year: bucket.year,
            month: bucket.month,
            leaveTypeId: leaveType.id,
            leaveTypeCode: leaveType.code,
            amountDays: take,
            note: `${leaveType.name} (${bucket.year}/${String(bucket.month).padStart(2, '0')})`,
          });
          entitlementLeft -= take;
        }
      }

      // Excess → per-bucket: original type → PAID → UNPAID
      if (remainingDays > 0) {
        const conversions = await this.getConversions(leaveType.id);
        for (const conv of conversions) {
          if (conv.reason !== 'EXCEED_MAX_PER_REQUEST' || remainingDays <= 0) continue;

          const paidType = conv.toLeaveType;

          // Determine which buckets have excess days after entitlement consumed
          let capLeft = entitlementDays;
          const excessBuckets: { year: number; month: number; excessDays: number }[] = [];
          for (const bucket of monthlyBuckets) {
            const consumed = Math.min(bucket.durationDays, capLeft);
            capLeft -= consumed;
            const excess = bucket.durationDays - consumed;
            if (excess > 0) {
              excessBuckets.push({ year: bucket.year, month: bucket.month, excessDays: excess });
            }
          }

          // Per-bucket paid balance check with running total per year
          const runningPaidByYear = new Map<number, number>();
          let totalFromPaid = 0;
          let totalUnpaid = 0;

          // Resolve PAID → UNPAID conversion once
          const paidConversions = await this.getConversions(paidType.id);
          const unpaidConv = paidConversions.find((c) => c.reason === 'EXCEED_BALANCE');
          const unpaidType = unpaidConv?.toLeaveType ?? (await this.getLeaveTypeByCode('UNPAID'));

          for (const eb of excessBuckets) {
            const runningUsed = runningPaidByYear.get(eb.year) ?? 0;
            const paidBalance = await this.getBalance(
              employeeId, paidType.id, eb.year, excludeRequestId, eb.month, manager,
            );
            const effectiveBalance = Math.max(paidBalance - runningUsed, 0);
            const paidTake = Math.min(eb.excessDays, effectiveBalance);
            const unpaidTake = eb.excessDays - paidTake;

            if (paidTake > 0) {
              monthlyAllocations.push({
                year: eb.year,
                month: eb.month,
                leaveTypeId: paidType.id,
                leaveTypeCode: paidType.code,
                amountDays: paidTake,
                note: `Excess from ${leaveType.name} → ${paidType.name} (${eb.year}/${String(eb.month).padStart(2, '0')})`,
              });
              runningPaidByYear.set(eb.year, runningUsed + paidTake);
              totalFromPaid += paidTake;
            }

            if (unpaidTake > 0 && unpaidType) {
              monthlyAllocations.push({
                year: eb.year,
                month: eb.month,
                leaveTypeId: unpaidType.id,
                leaveTypeCode: unpaidType.code,
                amountDays: unpaidTake,
                note: `Excess from ${leaveType.name} → ${unpaidType.name} (${eb.year}/${String(eb.month).padStart(2, '0')})`,
              });
              totalUnpaid += unpaidTake;
            }
          }

          // Build aggregated items for summary
          if (totalFromPaid > 0) {
            items.push({
              leaveTypeId: paidType.id,
              leaveTypeCode: paidType.code,
              amountDays: totalFromPaid,
              note: `Excess from ${leaveType.name} → ${paidType.name}`,
            });
            remainingDays -= totalFromPaid;
          }

          if (totalUnpaid > 0 && unpaidType) {
            items.push({
              leaveTypeId: unpaidType.id,
              leaveTypeCode: unpaidType.code,
              amountDays: totalUnpaid,
              note: `Excess from ${leaveType.name} → ${unpaidType.name}`,
            });
            remainingDays -= totalUnpaid;

            warnings.push(
              `Your paid leave balance is insufficient to cover the excess. ${totalUnpaid} day(s) will be deducted as unpaid leave.`,
            );

            // Check UNPAID annual limit
            const unpaidPolicy = await this.getActivePolicy(unpaidType.id, startDate);
            const unpaidUsed = await this.getUsedDays(employeeId, unpaidType.id, startyear, excludeRequestId, manager);
            const unpaidLimit = unpaidPolicy?.annualLimitDays
              ? Number(unpaidPolicy.annualLimitDays)
              : Infinity;
            if (unpaidUsed + totalUnpaid > unpaidLimit) {
              warnings.push(
                `Unpaid leave annual limit (${unpaidLimit} days/year) may be exceeded. ${unpaidUsed} days already used this year.`,
              );
            }
          }

          if (totalFromPaid === 0 && totalUnpaid === 0 && remainingDays > 0) {
            warnings.push(
              `Your paid leave balance is insufficient to cover the excess. ${remainingDays} day(s) will be deducted as unpaid leave.`,
            );
          }
        }
      }
    }

    // 2c. ANNUAL category — per-month balance check (no borrow across months)
    //
    // For each (year, month) bucket:
    //   earnedTo = cumulative accrual at that month
    //   usedTo   = RESERVE + APPROVAL debits minus RELEASE/REFUND
    //   available = getBalance(…, atMonth)
    //   paidUsed = min(need, available)
    //   remaining → UNPAID
    else if (categoryCode === LeaveCategory.ANNUAL) {
      const conversions = await this.getConversions(leaveType.id);
      const unpaidConv = conversions.find((c) => c.reason === 'EXCEED_BALANCE');
      const unpaidType = unpaidConv?.toLeaveType ?? (await this.getLeaveTypeByCode(LeaveTypes.UNPAID_LEAVE));
      const unpaidPolicy = unpaidType
        ? await this.getActivePolicy(unpaidType.id, startDate)
        : null;

      let totalPaid = 0;
      let totalUnpaid = 0;
      // Track running paid used PER YEAR — resets when crossing year boundary
      const runningPaidByYear = new Map<number, number>();

      for (const bucket of monthlyBuckets) {
        let monthRemaining = bucket.durationDays;
        const runningUsed = runningPaidByYear.get(bucket.year) ?? 0;

        // Available paid balance at this month
        const paidAvailableAtMonth = await this.getBalance(
          employeeId,
          leaveType.id,
          bucket.year,
          excludeRequestId,
          bucket.month,
          manager,
        );
        const effectiveAvailable = Math.max(paidAvailableAtMonth - runningUsed, 0);
        const paidFromMonth = Math.min(monthRemaining, effectiveAvailable);

        if (paidFromMonth > 0) {
          monthlyAllocations.push({
            year: bucket.year,
            month: bucket.month,
            leaveTypeId: leaveType.id,
            leaveTypeCode: leaveType.code,
            amountDays: paidFromMonth,
            note: `Paid leave (${bucket.year}/${String(bucket.month).padStart(2, '0')})`,
          });
          totalPaid += paidFromMonth;
          runningPaidByYear.set(bucket.year, runningUsed + paidFromMonth);
          monthRemaining -= paidFromMonth;
        }

        // Remaining → UNPAID for this month
        if (monthRemaining > 0 && unpaidType) {
          monthlyAllocations.push({
            year: bucket.year,
            month: bucket.month,
            leaveTypeId: unpaidType.id,
            leaveTypeCode: unpaidType.code,
            amountDays: monthRemaining,
            note: `Unpaid leave (${bucket.year}/${String(bucket.month).padStart(2, '0')})`,
          });
          totalUnpaid += monthRemaining;
        }
      }

      // Build aggregated items
      if (totalPaid > 0) {
        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: totalPaid,
          note: 'Paid leave',
        });
        remainingDays -= totalPaid;
      }

      if (totalUnpaid > 0 && unpaidType) {
        items.push({
          leaveTypeId: unpaidType.id,
          leaveTypeCode: unpaidType.code,
          amountDays: totalUnpaid,
          note: 'Unpaid leave (paid balance exceeded)',
        });
        remainingDays -= totalUnpaid;

        warnings.push(
          `Your paid leave balance is less than the requested ${durationDays} days. ` +
          `${totalUnpaid} day(s) will be deducted as unpaid leave.`,
        );

        const existingUnpaidUsed = await this.getUsedDays(
          employeeId,
          unpaidType.id,
          startyear,
          excludeRequestId,
          manager,
        );
        const unpaidLimit = unpaidPolicy?.annualLimitDays
          ? Number(unpaidPolicy.annualLimitDays)
          : Infinity;
        if (existingUnpaidUsed + totalUnpaid > unpaidLimit) {
          warnings.push(
            `Unpaid leave annual limit (${unpaidLimit} days/year) may be exceeded. ` +
            `${existingUnpaidUsed} days already used this year.`,
          );
        }
      }
    }

    // 2d. All other categories (COMPENSATORY, etc.)
    else {
      items.push({
        leaveTypeId: leaveType.id,
        leaveTypeCode: leaveType.code,
        amountDays: remainingDays,
        note: leaveType.name,
      });
      remainingDays = 0;
    }

    // Safety net
    if (remainingDays > 0) {
      const unpaidType = await this.getLeaveTypeByCode('UNPAID');
      if (unpaidType) {
        items.push({
          leaveTypeId: unpaidType.id,
          leaveTypeCode: unpaidType.code,
          amountDays: remainingDays,
          note: `Unpaid leave (remaining excess from ${leaveType.name})`,
        });
      } else {
        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: remainingDays,
          note: `${leaveType.name} (unallocated)`,
        });
      }
    }

    // Conversion notification
    if (items.length > 1) {
      const breakdown = items.map((i) => `${i.note}: ${i.amountDays} day(s)`).join('; ');
      warnings.unshift(
        `Your ${durationDays}-day leave request will be split across leave types: ${breakdown}.`,
      );
    }

    // ── Build monthlyAllocations for non-ANNUAL categories ──
    //
    // Uses sequential "waterfall" filling: each item's days are assigned
    // to months in chronological order, consuming up to each month's
    // working-day capacity before spilling into the next month.
    //
    // This prevents small entitlements (e.g. a 1-day Policy leave) from
    // being artificially split across months (0.5 + 0.5).
    // Items are processed in order — policy entitlement first, then the
    // PAID overflow, then UNPAID overflow — so the policy item naturally
    // fills the earliest days and stays whole.
    if (categoryCode !== LeaveCategory.ANNUAL && monthlyAllocations.length === 0) {
      const buckets =
        monthlyBuckets.length > 0
          ? monthlyBuckets
          : [
              {
                year: new Date(startDate).getFullYear(),
                month: new Date(startDate).getMonth() + 1,
                durationDays: durationDays,
                slots: durationDays * 2,
              },
            ];

      // Track remaining working-day capacity in each month bucket
      const capacities = buckets.map((b) => b.durationDays);
      console.log(capacities);
      for (const item of items) {
        let remaining = item.amountDays;

        for (let i = 0; i < buckets.length && remaining > 0; i++) {
          const canTake = Math.round(Math.min(remaining, capacities[i]) * 2) / 2;
          if (canTake > 0) {
            monthlyAllocations.push({
              year: buckets[i].year,
              month: buckets[i].month,
              leaveTypeId: item.leaveTypeId,
              leaveTypeCode: item.leaveTypeCode,
              amountDays: canTake,
              note: item.note,
            });
            capacities[i] -= canTake;
            remaining -= canTake;
          }
        }

        // Safety: if there are leftover days (rounding edge-case), add to last bucket
        if (remaining > 0) {
          const lastIdx = buckets.length - 1;
          const lastAlloc = monthlyAllocations[monthlyAllocations.length - 1];
          if (
            lastAlloc &&
            lastAlloc.year === buckets[lastIdx].year &&
            lastAlloc.month === buckets[lastIdx].month &&
            lastAlloc.leaveTypeId === item.leaveTypeId
          ) {
            lastAlloc.amountDays = Math.round((lastAlloc.amountDays + remaining) * 2) / 2;
          } else {
            monthlyAllocations.push({
              year: buckets[lastIdx].year,
              month: buckets[lastIdx].month,
              leaveTypeId: item.leaveTypeId,
              leaveTypeCode: item.leaveTypeCode,
              amountDays: Math.round(remaining * 2) / 2,
              note: item.note,
            });
          }
        }
      }
    }

    // ── Guards: catch allocation bugs before DB save ──
    if (monthlyAllocations.length > 0) {
      // P1-5: no duplicate (leaveTypeId, year, month) buckets
      validateAllocationsNoDuplicateBucket(monthlyAllocations);
      // P1-6: sum must equal total duration
      assertAllocationSum(monthlyAllocations, durationDays);
    } else if (items.length > 0) {
      assertAllocationSum(items, durationDays);
    }

    return {
      durationDays,
      items,
      monthlyAllocations,
      warnings,
      canProceed: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 1 — SUBMIT: Reserve Balance
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Validate, allocate, and create DEBIT RESERVE transactions in a single
   * serialised DB transaction (advisory lock per employee+type+year).
   *
   * Returns the validation result so the caller can persist the
   * leave_request & items inside the same queryRunner.
   *
   * @param manager  EntityManager from the caller's queryRunner (REQUIRED).
   */
  async reserveBalanceForSubmit(
    manager: EntityManager,
    employeeId: number,
    leaveRequestId: number,
    leaveTypeId: number,
    startDate: string,
    endDate: string,
    startSession: LeaveSession,
    endSession: LeaveSession,
    excludeRequestId?: number,
    parentalOptions?: {
      numberOfChildren?: number;
      childbirthMethod?: ChildbirthMethod;
    },
  ): Promise<LeaveValidationResult> {
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate + 'T00:00:00').getFullYear();

    // Lock the primary leave type for each year in range
    for (let y = startYear; y <= endYear; y++) {
      await this.acquireBalanceLock(manager, employeeId, leaveTypeId, y);
    }

    // Run allocation under the lock
    const validation = await this.validateAndPrepare(
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      startSession,
      endSession,
      excludeRequestId,
      parentalOptions,
      manager,
    );

    // Lock any additional leave types from conversion (e.g. UNPAID)
    const additionalTypeIds = new Set(
      validation.monthlyAllocations
        .map((a) => a.leaveTypeId)
        .filter((id) => id !== leaveTypeId),
    );
    for (const typeId of additionalTypeIds) {
      for (let y = startYear; y <= endYear; y++) {
        await this.acquireBalanceLock(manager, employeeId, typeId, y);
      }
    }

    // Re-validate if additional types appeared (balance might have changed)
    let finalValidation = validation;
    if (additionalTypeIds.size > 0) {
      finalValidation = await this.validateAndPrepare(
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        startSession,
        endSession,
        excludeRequestId,
        parentalOptions,
        manager,
      );
    }

    // Create DEBIT RESERVE transactions for each monthly allocation
    // Now includes UNPAID allocations — limit-based model tracks usage via ledger
    const reserveTxs: Partial<LeaveBalanceTransaction>[] = [];
    for (const alloc of finalValidation.monthlyAllocations) {
      reserveTxs.push({
        employeeId,
        leaveTypeId: alloc.leaveTypeId,
        periodYear: alloc.year,
        periodMonth: alloc.month,
        direction: BalanceTxDirection.DEBIT,
        amountDays: alloc.amountDays,
        sourceType: BalanceTxSource.RESERVE,
        sourceId: leaveRequestId,
        note: `Leave #${leaveRequestId} reserve – ${alloc.year}/${String(alloc.month).padStart(2, '0')} (${alloc.leaveTypeCode})`,
      });
    }

    if (reserveTxs.length > 0) {
      await manager.getRepository(LeaveBalanceTransaction).save(reserveTxs);
      this.logger.log(
        `[reserveBalanceForSubmit] Leave #${leaveRequestId}: ${reserveTxs.length} RESERVE transaction(s)`,
      );
    }

    return finalValidation;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 2 — APPROVE: Convert RESERVE → APPROVAL
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Update all RESERVE debit transactions for a request to APPROVAL.
   * The debit stays but source_type changes from RESERVE to APPROVAL.
   */
  async convertReserveToApproval(
    employeeId: number,
    leaveRequestId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(LeaveBalanceTransaction)
      : this.balanceTxRepo;

    const result = await repo
      .createQueryBuilder()
      .update(LeaveBalanceTransaction)
      .set({ sourceType: BalanceTxSource.APPROVAL })
      .where('employee_id = :employeeId', { employeeId })
      .andWhere('source_id = :leaveRequestId', { leaveRequestId })
      .andWhere('source_type = :reserve', { reserve: BalanceTxSource.RESERVE })
      .andWhere('direction = :debit', { debit: BalanceTxDirection.DEBIT })
      .execute();

    const affected = result.affected ?? 0;
    this.logger.log(
      `[convertReserveToApproval] Leave #${leaveRequestId}: ${affected} row(s) RESERVE → APPROVAL`,
    );
    return affected;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 3 — REJECT / CANCEL before approve: Release Reserve
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create CREDIT RELEASE transactions to reverse all RESERVE debits
   * for a given leave request.
   */
  async releaseReserveForRejection(
    employeeId: number,
    leaveRequestId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LeaveBalanceTransaction)
      : this.balanceTxRepo;

    const reserveDebits = await repo.find({
      where: {
        employeeId,
        sourceId: leaveRequestId,
        sourceType: BalanceTxSource.RESERVE,
        direction: BalanceTxDirection.DEBIT,
      },
    });

    if (reserveDebits.length === 0) {
      this.logger.warn(
        `[releaseReserveForRejection] No RESERVE debits found for leave #${leaveRequestId}`,
      );
      return;
    }

    const releaseTxs: Partial<LeaveBalanceTransaction>[] = reserveDebits.map((debit) => ({
      employeeId,
      leaveTypeId: debit.leaveTypeId,
      periodYear: debit.periodYear,
      periodMonth: debit.periodMonth,
      direction: BalanceTxDirection.CREDIT,
      amountDays: Number(debit.amountDays),
      sourceType: BalanceTxSource.RELEASE,
      sourceId: leaveRequestId,
      note: `Leave #${leaveRequestId} rejected/cancelled – release ${debit.periodYear}/${String(debit.periodMonth).padStart(2, '0')}`,
    }));

    await repo.save(releaseTxs);
    this.logger.log(
      `[releaseReserveForRejection] Leave #${leaveRequestId}: ${releaseTxs.length} RELEASE credit(s)`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 4 — CANCEL after approve: Refund
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create CREDIT REFUND transactions to reverse all APPROVAL debits.
   */
  async refundBalanceForCancellation(
    employeeId: number,
    leaveRequestId: number,
    items: LeaveRequestItem[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LeaveBalanceTransaction)
      : this.balanceTxRepo;

    const approvalDebits = await repo.find({
      where: {
        employeeId,
        sourceId: leaveRequestId,
        sourceType: BalanceTxSource.APPROVAL,
        direction: BalanceTxDirection.DEBIT,
      },
    });

    const transactions: Partial<LeaveBalanceTransaction>[] = [];

    if (approvalDebits.length > 0) {
      for (const debit of approvalDebits) {
        transactions.push({
          employeeId,
          leaveTypeId: debit.leaveTypeId,
          periodYear: debit.periodYear,
          periodMonth: debit.periodMonth,
          direction: BalanceTxDirection.CREDIT,
          amountDays: Number(debit.amountDays),
          sourceType: BalanceTxSource.REFUND,
          sourceId: leaveRequestId,
          note: `Leave #${leaveRequestId} cancelled – refund ${debit.periodYear}/${String(debit.periodMonth).padStart(2, '0')}`,
        });
      }
    } else {
      // Legacy fallback — use item's periodYear/periodMonth directly
      for (const item of items) {
        transactions.push({
          employeeId,
          leaveTypeId: item.leaveTypeId,
          periodYear: item.periodYear,
          periodMonth: item.periodMonth,
          direction: BalanceTxDirection.CREDIT,
          amountDays: Number(item.amountDays),
          sourceType: BalanceTxSource.REFUND,
          sourceId: leaveRequestId,
          note: `Leave request #${leaveRequestId} cancelled – refund ${item.periodYear}/${String(item.periodMonth).padStart(2, '0')}`,
        });
      }
    }

    await repo.save(transactions);
    this.logger.log(
      `[refundBalanceForCancellation] Leave #${leaveRequestId}: ${transactions.length} REFUND credit(s)`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Suggest End Date
  // ═══════════════════════════════════════════════════════════════════

  async suggestEndDate(
    leaveTypeId: number,
    startDate: string,
    startSession: LeaveSession,
    parentalOptions?: {
      employeeId?: number;
      numberOfChildren?: number;
      childbirthMethod?: ChildbirthMethod;
    },
  ): Promise<{ suggestedEndDate: string; suggestedEndSession: LeaveSession } | null> {
    const leaveType = await this.getLeaveTypeById(leaveTypeId);
    if (!leaveType) return null;

    const policy = await this.getActivePolicy(leaveTypeId, startDate);
    if (!policy?.autoCalculateEndDate || !policy.maxPerRequestDays) return null;

    if (leaveType.code === LeaveTypes.PARENTAL_LEAVE && parentalOptions?.employeeId) {
      const user = await this.userRepo.findOne({ where: { id: parentalOptions.employeeId } });
      const isFemale = user?.gender === UserGender.FEMALE;

        if (isFemale) {
      const numChildren = parentalOptions?.numberOfChildren ?? 1;

      const start = new Date(startDate + 'T00:00:00');
      const startDay = start.getDate();

      // add 6 months safely
      const end = new Date(start);
      end.setMonth(end.getMonth() + 6);

      // if day overflowed (e.g., 31st -> next month), clamp to last day of target month
      if (end.getDate() !== startDay) {
        end.setDate(0); // last day of previous month
      }

      // inclusive: subtract 1 day
      end.setDate(end.getDate() - 1);

      const msPerDay = 24 * 60 * 60 * 1000;
      const sixMonthsDays = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;

      const entitlementDays = sixMonthsDays + Math.max(0, numChildren - 1) * 30;
      const result = calculateCalendarEndDate(startDate, startSession, entitlementDays);
      return { suggestedEndDate: result.endDate, suggestedEndSession: result.endSession };
    } else {
        const entitlement =
          parentalOptions.childbirthMethod === ChildbirthMethod.C_SECTION ? 7 : 5;
        const auto = await autoCalculateEndDate(
          this.calendarRepo,
          startDate,
          startSession,
          entitlement,
        );
        return {
          suggestedEndDate: auto.endDate,
          suggestedEndSession: auto.endSession,
        };
      }
    }

    const maxDays = Number(policy.maxPerRequestDays);
    const auto = await autoCalculateEndDate(
      this.calendarRepo,
      startDate,
      startSession,
      maxDays,
    );

    return {
      suggestedEndDate: auto.endDate,
      suggestedEndSession: auto.endSession,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Used Days (from ledger)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Net used days = DEBIT(RESERVE+APPROVAL) – CREDIT(RELEASE+REFUND)
   */
  async getUsedDays(
    employeeId: number,
    leaveTypeId: number,
    year: number,
    excludeRequestId?: number,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(LeaveBalanceTransaction)
      : this.balanceTxRepo;

    let debitQb = repo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
      .where('tx.employee_id = :employeeId', { employeeId })
      .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('tx.period_year = :year', { year })
      .andWhere("tx.direction = 'DEBIT'")
      .andWhere("tx.source_type IN ('RESERVE', 'APPROVAL')");

    if (excludeRequestId) {
      debitQb = debitQb.andWhere(
        '(tx.source_id IS NULL OR tx.source_id != :excludeRequestId)',
        { excludeRequestId },
      );
    }

    const debitResult = await debitQb.getRawOne();
    const totalDebit = parseFloat(debitResult?.total ?? '0');

    let creditQb = repo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
      .where('tx.employee_id = :employeeId', { employeeId })
      .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('tx.period_year = :year', { year })
      .andWhere("tx.direction = 'CREDIT'")
      .andWhere("tx.source_type IN ('RELEASE', 'REFUND')");

    if (excludeRequestId) {
      creditQb = creditQb.andWhere(
        '(tx.source_id IS NULL OR tx.source_id != :excludeRequestId)',
        { excludeRequestId },
      );
    }

    const creditResult = await creditQb.getRawOne();
    const totalReleaseRefund = parseFloat(creditResult?.total ?? '0');

    return Math.max(totalDebit - totalReleaseRefund, 0);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Balance Initialization & Accrual
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Initialize yearly paid leave balance for all active employees.
   * Creates per-month CREDIT MONTHLY_ACCRUAL transactions.
   */
  async initializeYearlyBalance(
    year: number,
    annualDays = 12,
  ): Promise<{ credited: number; skipped: number; total: number }> {
    const paidType = await this.leaveTypeRepo.findOne({
      where: { code: 'PAID', isActive: true },
    });
    if (!paidType) {
      throw new Error('PAID leave type not found');
    }

    const policy = await this.getActivePolicy(paidType.id, `${year}-01-01`);
    const monthlyRate = policy?.monthlyLimitDays
      ? Number(policy.monthlyLimitDays)
      : annualDays / 12;

    const activeUsers = await this.userRepo.find({
      where: { status: UserStatus.ACTIVE },
      select: ['id'],
    });

    if (activeUsers.length === 0) {
      return { credited: 0, skipped: 0, total: 0 };
    }

    const existing = await this.balanceTxRepo
      .createQueryBuilder('tx')
      .select('tx.employee_id', 'employeeId')
      .where('tx.leave_type_id = :leaveTypeId', { leaveTypeId: paidType.id })
      .andWhere('tx.period_year = :year', { year })
      .andWhere('tx.source_type = :sourceType', { sourceType: BalanceTxSource.MONTHLY_ACCRUAL })
      .groupBy('tx.employee_id')
      .getRawMany();

    const existingIds = new Set(existing.map((r) => Number(r.employeeId)));
    const toCredit = activeUsers.filter((u) => !existingIds.has(u.id));

    if (toCredit.length > 0) {
      const transactions: Partial<LeaveBalanceTransaction>[] = [];
      for (const user of toCredit) {
        for (let m = 1; m <= 12; m++) {
          transactions.push({
            employeeId: user.id,
            leaveTypeId: paidType.id,
            periodYear: year,
            periodMonth: m,
            direction: BalanceTxDirection.CREDIT,
            amountDays: monthlyRate,
            sourceType: BalanceTxSource.MONTHLY_ACCRUAL,
            sourceId: null,
            note: `Paid leave accrual ${year}/${String(m).padStart(2, '0')} (${monthlyRate} day)`,
          });
        }
      }
      await this.balanceTxRepo.save(transactions);
    }

    this.logger.log(
      `[initializeYearlyBalance] Year ${year}: credited ${toCredit.length} employees ` +
      `(${toCredit.length * 12} monthly transactions), skipped ${existingIds.size}, ` +
      `total active ${activeUsers.length}`,
    );

    return {
      credited: toCredit.length,
      skipped: existingIds.size,
      total: activeUsers.length,
    };
  }

  /**
   * Run monthly accrual for a specific month (called by cron on 1st of each month).
   *
   * Creates CREDIT MONTHLY_ACCRUAL for each active employee that doesn't
   * already have one for (year, month, PAID). Partial unique index guarantees
   * idempotency at DB level.
   */
  async runMonthlyAccrual(
    year: number,
    month: number,
  ): Promise<{ credited: number; skipped: number }> {
    const paidType = await this.leaveTypeRepo.findOne({
      where: { code: 'PAID', isActive: true },
    });
    if (!paidType) throw new Error('PAID leave type not found');

    const policy = await this.getActivePolicy(paidType.id, `${year}-01-01`);
    const monthlyRate = policy?.monthlyLimitDays
      ? Number(policy.monthlyLimitDays)
      : 1;

    const activeUsers = await this.userRepo.find({
      where: { status: UserStatus.ACTIVE },
      select: ['id'],
    });

    const existing = await this.balanceTxRepo
      .createQueryBuilder('tx')
      .select('tx.employee_id', 'employeeId')
      .where('tx.leave_type_id = :leaveTypeId', { leaveTypeId: paidType.id })
      .andWhere('tx.period_year = :year', { year })
      .andWhere('tx.period_month = :month', { month })
      .andWhere('tx.source_type = :sourceType', { sourceType: BalanceTxSource.MONTHLY_ACCRUAL })
      .getRawMany();

    const existingIds = new Set(existing.map((r) => Number(r.employeeId)));
    const toCredit = activeUsers.filter((u) => !existingIds.has(u.id));

    if (toCredit.length > 0) {
      const transactions: Partial<LeaveBalanceTransaction>[] = toCredit.map((user) => ({
        employeeId: user.id,
        leaveTypeId: paidType.id,
        periodYear: year,
        periodMonth: month,
        direction: BalanceTxDirection.CREDIT,
        amountDays: monthlyRate,
        sourceType: BalanceTxSource.MONTHLY_ACCRUAL,
        sourceId: null,
        note: `Paid leave accrual ${year}/${String(month).padStart(2, '0')} (${monthlyRate} day)`,
      }));
      await this.balanceTxRepo.save(transactions);
    }

    this.logger.log(
      `[runMonthlyAccrual] ${year}/${month}: credited ${toCredit.length}, skipped ${existingIds.size}`,
    );

    return { credited: toCredit.length, skipped: existingIds.size };
  }

  /**
   * Initialize balance for a single employee (e.g. on activation).
   */
  async initializeBalanceForEmployee(
    employeeId: number,
    year: number,
    annualDays = 12,
  ): Promise<{ credited: boolean; days: number; months: number }> {
    const paidType = await this.leaveTypeRepo.findOne({
      where: { code: 'PAID', isActive: true },
    });
    if (!paidType) {
      throw new Error('PAID leave type not found');
    }

    const existing = await this.balanceTxRepo.findOne({
      where: {
        employeeId,
        leaveTypeId: paidType.id,
        periodYear: year,
        sourceType: BalanceTxSource.MONTHLY_ACCRUAL,
      },
    });

    if (existing) {
      return { credited: false, days: 0, months: 0 };
    }

    const policy = await this.getActivePolicy(paidType.id, `${year}-01-01`);
    const monthlyRate = policy?.monthlyLimitDays
      ? Number(policy.monthlyLimitDays)
      : annualDays / 12;

    const startMonth = new Date().getMonth() + 1;
    const transactions: Partial<LeaveBalanceTransaction>[] = [];

    for (let m = startMonth; m <= 12; m++) {
      transactions.push({
        employeeId,
        leaveTypeId: paidType.id,
        periodYear: year,
        periodMonth: m,
        direction: BalanceTxDirection.CREDIT,
        amountDays: monthlyRate,
        sourceType: BalanceTxSource.MONTHLY_ACCRUAL,
        sourceId: null,
        note: `Paid leave accrual ${year}/${String(m).padStart(2, '0')} (${monthlyRate} day, employee init)`,
      });
    }

    const totalDays = Math.round(transactions.length * monthlyRate * 2) / 2;

    await this.balanceTxRepo.save(transactions);

    this.logger.log(
      `[initializeBalanceForEmployee] Employee ${employeeId}: ${transactions.length} monthly accruals ` +
      `(${totalDays} days total) for ${year} starting month ${startMonth}`,
    );

    return { credited: true, days: totalDays, months: transactions.length };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Balance Summary & Reports
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get balance summary for an employee for a given year/month.
   *
   * Fields:
   *  - used:      net days consumed (DEBIT – RELEASE/REFUND)
   *  - remaining: days still available (logic varies by leave type)
   *
   * PAID    → remaining = getBalance(atMonth) — accrual capped at effectiveMonth, debits full-year
   * UNPAID  → used = net debits up to effectiveMonth; remaining = annualLimit (30) − used
   * COMP    → remaining = entitlementCredit − netDebit
   */
  async getEmployeeBalanceSummary(
    employeeId: number,
    month: number,
    year: number,
  ): Promise<
    {
      leaveTypeId: number;
      leaveTypeCode: string;
      leaveTypeName: string;
      categoryCode: string;
      categoryName: string;
      unit: 'days' | 'hours';
      used: number;
      remaining: number;
      pendingDays: number;
      annualLimit: number | null;
      monthlyAccrual: number | null;
    }[]
  > {
    const effectiveMonth = month ?? new Date().getMonth() + 1;


    const leaveTypes = await this.leaveTypeRepo
      .createQueryBuilder('lt')
      .leftJoinAndSelect('lt.category', 'category')
      .where('lt.code IN (:...codes)', { codes: Object.values(BALANCE_TYPE_CODES) })
      .andWhere('lt.is_active = true')
      .orderBy('lt.id', 'ASC')
      .getMany();

    this.logger.log(
      `[getEmployeeBalanceSummary] employee=${employeeId} month=${effectiveMonth} year=${year} leaveTypes=${leaveTypes.map((l) => l.code).join(',')}`,
    );

    const result = [];

    for (const lt of leaveTypes) {
      const policy = await this.getActivePolicy(lt.id, `${year}-01-01`);
      const unit: 'days' | 'hours' = lt.code === BALANCE_TYPE_CODES.COMPENSATORY_LEAVE ? 'hours' : 'days';

      // Reversal credits (RELEASE + REFUND) — full year
      const reversalCreditResult = await this.balanceTxRepo
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
        .where('tx.employee_id = :employeeId', { employeeId })
        .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
        .andWhere('tx.period_year = :year', { year })
        .andWhere("tx.direction = 'CREDIT'")
        .andWhere("tx.source_type IN ('RELEASE', 'REFUND')")
        .getRawOne();
      const reversalCredit = parseFloat(reversalCreditResult?.total ?? '0');

      // Gross debit (RESERVE + APPROVAL) — full year
      const grossDebitResult = await this.balanceTxRepo
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
        .where('tx.employee_id = :employeeId', { employeeId })
        .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
        .andWhere('tx.period_year = :year', { year })
        .andWhere("tx.direction = 'DEBIT'")
        .getRawOne();
      const grossDebit = parseFloat(grossDebitResult?.total ?? '0');

      // Pending = RESERVE debits only (submitted but not yet approved)
      const pendingResult = await this.balanceTxRepo
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
        .where('tx.employee_id = :employeeId', { employeeId })
        .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
        .andWhere('tx.period_year = :year', { year })
        .andWhere("tx.direction = 'DEBIT'")
        .andWhere("tx.source_type = 'RESERVE'")
        .getRawOne();
      const pendingDays = parseFloat(pendingResult?.total ?? '0');

      // Net days consumed for the year (gross debit minus reversals)
      const netDebit = Math.max(grossDebit - reversalCredit, 0);

      if (lt.code === BALANCE_TYPE_CODES.PAID_LEAVE) {
        const monthlyRate = policy?.monthlyLimitDays ? Number(policy.monthlyLimitDays) : 1;
        const annualLimit = policy?.annualLimitDays ? Number(policy.annualLimitDays) : null;

        // remaining: accrual capped at effectiveMonth, all debits counted (full year)
        const remaining = await this.getBalance(employeeId, lt.id, year, undefined, effectiveMonth);

        result.push({
          leaveTypeId: Number(lt.id),
          leaveTypeCode: lt.code,
          leaveTypeName: lt.name,
          categoryCode: lt.category?.code ?? '',
          categoryName: lt.category?.name ?? '',
          unit,
          used: netDebit,
          remaining: Math.max(remaining, 0),
          pendingDays,
          annualLimit,
          monthlyAccrual: monthlyRate,
        });
      } else if (lt.code === BALANCE_TYPE_CODES.UNPAID_LEAVE) {
        const annualLimit = policy?.annualLimitDays ? Number(policy.annualLimitDays) : 30;

        // used: net debits from start of year up to effectiveMonth (inclusive)
        const unpaidDebitResult = await this.balanceTxRepo
          .createQueryBuilder('tx')
          .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
          .where('tx.employee_id = :employeeId', { employeeId })
          .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
          .andWhere('tx.period_year = :year', { year })
          .andWhere('tx.period_month <= :effectiveMonth', { effectiveMonth })
          .andWhere("tx.direction = 'DEBIT'")
          .getRawOne();
        const unpaidGrossDebit = parseFloat(unpaidDebitResult?.total ?? '0');

        const unpaidReleasesResult = await this.balanceTxRepo
          .createQueryBuilder('tx')
          .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
          .where('tx.employee_id = :employeeId', { employeeId })
          .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
          .andWhere('tx.period_year = :year', { year })
          .andWhere('tx.period_month <= :effectiveMonth', { effectiveMonth })
          .andWhere("tx.direction = 'CREDIT'")
          .andWhere("tx.source_type IN ('RELEASE', 'REFUND')")
          .getRawOne();
        const unpaidReleases = parseFloat(unpaidReleasesResult?.total ?? '0');

        const used = Math.max(unpaidGrossDebit - unpaidReleases, 0);

        result.push({
          leaveTypeId: Number(lt.id),
          leaveTypeCode: lt.code,
          leaveTypeName: lt.name,
          categoryCode: lt.category?.code ?? '',
          categoryName: lt.category?.name ?? '',
          unit,
          used,
          remaining: Math.max(annualLimit - used, 0),
          pendingDays,
          annualLimit,
          monthlyAccrual: null,
        });
      } else {
        // COMP (and any future types): entitlementCredit − netDebit
        const entitlementResult = await this.balanceTxRepo
          .createQueryBuilder('tx')
          .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
          .where('tx.employee_id = :employeeId', { employeeId })
          .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
          .andWhere('tx.period_year = :year', { year })
          .andWhere("tx.direction = 'CREDIT'")
          .andWhere("tx.source_type NOT IN ('RELEASE', 'REFUND')")
          .getRawOne();
        const entitlementCredit = parseFloat(entitlementResult?.total ?? '0');

        result.push({
          leaveTypeId: Number(lt.id),
          leaveTypeCode: lt.code,
          leaveTypeName: lt.name,
          categoryCode: lt.category?.code ?? '',
          categoryName: lt.category?.name ?? '',
          unit,
          used: netDebit,
          remaining: Math.max(entitlementCredit - netDebit, 0),
          pendingDays,
          annualLimit: policy?.annualLimitDays ? Number(policy.annualLimitDays) : null,
          monthlyAccrual: null,
        });
      }
    }

    this.logger.log(
      `[getEmployeeBalanceSummary] employee=${employeeId} →  returned ${result.length} items`,
    );
    return result;
  }

  
}
