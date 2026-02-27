/**
 * Leave Balance Service
 *
 * Provides balance queries and balance-related operations for leave requests.
 * Uses the ledger pattern via leave_balance_transactions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LeaveBalanceTransaction } from '@entities/leave-balance-transaction.entity';
import { LeaveType } from '@entities/leave-type.entity';
import { LeaveTypePolicy } from '@entities/leave-type-policy.entity';
import { LeaveTypeConversion } from '@entities/leave-type-conversion.entity';
import { LeaveRequestItem } from '@entities/leave-request-item.entity';
import { LeaveRequest } from '@entities/leave_request.entity';
import { CalendarOverride } from '@entities/calendar-override.entity';
import { User } from '@entities/users.entity';
import { UserStatus } from '@/common/enums/user-status.enum';
import { calculateLeaveDuration, autoCalculateEndDate, calculateCalendarDuration, calculateCalendarEndDate } from './utils/duration-calculator';
import { LeaveSession } from '@/common/enums/leave-session.enum';
import { ChildbirthMethod } from '@/common/enums/childbirth-method.enum';
import { UserGender } from '@/common/enums/user-genders';

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

export interface LeaveValidationResult {
  /** Total duration in days */
  durationDays: number;
  /** Breakdown of leave type items (after conversion) */
  items: ConversionItem[];
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
  ) {}

  /**
   * Sum of amount_days from pending leave request items for a given leave type.
   * Used to "reserve" balance for requests that haven't been approved yet.
   */
  private async getPendingItemDays(
    employeeId: number,
    leaveTypeId: number,
    year: number,
    excludeRequestId?: number,
  ): Promise<number> {
    let qb = this.leaveRequestItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.leaveRequest', 'lr')
      .select('COALESCE(SUM(item.amount_days), 0)', 'total')
      .where('lr.user_id = :employeeId', { employeeId })
      .andWhere('lr.status = :status', { status: 'pending' })
      .andWhere('item.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('EXTRACT(YEAR FROM lr.start_date) = :year', { year });

    if (excludeRequestId) {
      qb = qb.andWhere('lr.id != :excludeId', { excludeId: excludeRequestId });
    }

    const result = await qb.getRawOne();
    return parseFloat(result?.total ?? '0');
  }

  /**
   * Get current available balance for a specific leave type + employee + year.
   * Includes pending request items as reserved (subtracted from balance).
   */
  async getBalance(
    employeeId: number,
    leaveTypeId: number,
    year: number,
    excludeRequestId?: number,
  ): Promise<number> {
    const result = await this.balanceTxRepo
      .createQueryBuilder('tx')
      .select(
        `SUM(CASE WHEN tx.direction = 'CREDIT' THEN tx.amount_days ELSE -tx.amount_days END)`,
        'balance',
      )
      .where('tx.employee_id = :employeeId', { employeeId })
      .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('tx.period_year = :year', { year })
      .getRawOne();

    const txBalance = parseFloat(result?.balance ?? '0');

    // Subtract days from pending requests (not yet approved = not yet debited)
    const pendingDays = await this.getPendingItemDays(
      employeeId,
      leaveTypeId,
      year,
      excludeRequestId,
    );

    return txBalance - pendingDays;
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

  /**
   * Main validation + conversion logic for a leave request submission.
   *
   * Flow:
   * 1. Lookup leave type + active policy
   * 2. Calculate duration from user-provided dates (endDate is always user input)
   * 3. If policy has max_per_request_days → split excess via conversion chain
   * 4. For ANNUAL category: check paid balance → overflow to unpaid
   * 5. Return items breakdown + warnings
   *
   * Note: auto_calculate_end_date is only used as a frontend suggestion
   * (via suggestEndDate method). The final endDate/duration always comes
   * from what the user actually submits.
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
  ): Promise<LeaveValidationResult> {
    const leaveType = await this.getLeaveTypeById(leaveTypeId);
    if (!leaveType) {
      throw new Error(`Leave type ${leaveTypeId} not found or inactive`);
    }

    const policy = await this.getActivePolicy(leaveTypeId, startDate);
    const year = new Date(startDate).getFullYear();
    const categoryCode = leaveType.category?.code ?? '';

    const warnings: string[] = [];
    // Always use user-provided endDate and endSession
    const finalEndDate = endDate;
    const finalEndSession = endSession;

    // ── Step 1: Calculate duration from user-provided dates ──
    // Special handling for PARENTAL leave (maternity):
    //   - Female: maternity entitlement in CALENDAR days (weekends/holidays included)
    //   - Male: working days as usual
    //   - Excess beyond entitlement: working days (skip weekends/holidays), then conversion
    const isParentalLeave = leaveType.code === 'PARENTAL';
    let durationDays: number;
    let parentalEntitlementDays = 0; // calendar days for female maternity
    let excessWorkingDays = 0;

    if (isParentalLeave) {
      const user = await this.userRepo.findOne({ where: { id: employeeId } });
      const isFemale = user?.gender === UserGender.FEMALE;

      if (isFemale) {
        // Female maternity: 180 calendar days + (N-1)*30 for twins+
        const numChildren = parentalOptions?.numberOfChildren ?? 1;
        parentalEntitlementDays = 180 + Math.max(0, numChildren - 1) * 30;

        // Calculate total calendar days user requested
        const calendarDuration = calculateCalendarDuration(
          startDate, finalEndDate, startSession, finalEndSession,
        );

        if (calendarDuration.durationDays <= 0) {
          throw new Error('Leave duration must be at least 0.5 days');
        }

        if (calendarDuration.durationDays <= parentalEntitlementDays) {
          // Entire request within maternity entitlement → all calendar days
          durationDays = calendarDuration.durationDays;
        } else {
          // Request extends beyond maternity entitlement
          // Find the calendar end date of the maternity entitlement
          const maternityEnd = calculateCalendarEndDate(
            startDate, startSession, parentalEntitlementDays,
          );

          // Calculate working days for the excess period (day after maternity end → user's endDate)
          const excessStartDate = new Date(maternityEnd.endDate + 'T00:00:00');
          let excessStartSession: LeaveSession;
          if (maternityEnd.endSession === LeaveSession.PM) {
            // Maternity ended at PM, excess starts next day AM
            excessStartDate.setDate(excessStartDate.getDate() + 1);
            excessStartSession = LeaveSession.AM;
          } else {
            // Maternity ended at AM, excess starts same day PM
            excessStartSession = LeaveSession.PM;
          }

          const fmtDate = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          };

          const excessStartStr = fmtDate(excessStartDate);
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
        // Male paternity: 5 working days (natural) or 7 working days (c-section)
        const entitlement =
          parentalOptions?.childbirthMethod === ChildbirthMethod.C_SECTION ? 7 : 5;
        parentalEntitlementDays = entitlement; // for male this is in working days

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
      // Non-parental leave: standard working day calculation
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

    // ── Step 2: Build items with conversion logic ───────────
    const items: ConversionItem[] = [];
    let remainingDays = durationDays;

    // 2a. PARENTAL leave — special handling
    if (isParentalLeave) {
      const coveredDays = durationDays - excessWorkingDays; // maternity entitlement portion
      items.push({
        leaveTypeId: leaveType.id,
        leaveTypeCode: leaveType.code,
        amountDays: coveredDays,
        note: `${leaveType.name} (maternity/paternity entitlement)`,
      });
      remainingDays = excessWorkingDays;

      // Excess → auto-convert via conversion chain
      if (remainingDays > 0) {
        const conversions = await this.getConversions(leaveType.id);
        for (const conv of conversions) {
          if (conv.reason !== 'EXCEED_MAX_PER_REQUEST' || remainingDays <= 0) continue;

          const paidType = conv.toLeaveType;
          const paidBalance = await this.getBalance(employeeId, paidType.id, year, excludeRequestId);
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
              const unpaidUsed = await this.getUsedDays(employeeId, unpaidType.id, year, excludeRequestId);
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
    }

    // 2b. POLICY / SOCIAL categories (non-parental)
    else if (categoryCode === 'POLICY' || categoryCode === 'SOCIAL') {
      if (policy?.maxPerRequestDays) {
        // Allocate up to maxPerRequestDays as the original leave type
        const maxDays = Number(policy.maxPerRequestDays);
        const coveredDays = Math.min(remainingDays, maxDays);
        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: coveredDays,
          note: `${leaveType.name} (policy entitlement)`,
        });
        remainingDays -= coveredDays;
      } else {
        // No max per request → all days go to this leave type
        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: remainingDays,
          note: leaveType.name,
        });
        remainingDays = 0;
      }

      // Excess → auto-convert: original type → PAID → UNPAID
      if (remainingDays > 0) {
        const conversions = await this.getConversions(leaveType.id);
        for (const conv of conversions) {
          if (conv.reason !== 'EXCEED_MAX_PER_REQUEST' || remainingDays <= 0) continue;

          const paidType = conv.toLeaveType;
          const paidBalance = await this.getBalance(employeeId, paidType.id, year, excludeRequestId);
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

          // Warn if paid balance is insufficient
          if (remainingDays > 0) {
            warnings.push(
              `Your paid leave balance (${paidBalance} days) is insufficient to cover the excess. ${remainingDays} days will be deducted as unpaid leave.`,
            );
          }

          // PAID → UNPAID chain for any remaining excess
          if (remainingDays > 0) {
            const paidConversions = await this.getConversions(paidType.id);
            for (const paidConv of paidConversions) {
              if (paidConv.reason !== 'EXCEED_BALANCE' || remainingDays <= 0) continue;
              const unpaidType = paidConv.toLeaveType;

              const unpaidPolicy = await this.getActivePolicy(unpaidType.id, startDate);
              const unpaidUsed = await this.getUsedDays(employeeId, unpaidType.id, year, excludeRequestId);
              const unpaidLimit = unpaidPolicy?.annualLimitDays
                ? Number(unpaidPolicy.annualLimitDays)
                : Infinity;
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
    }

    // 2c. ANNUAL category (Paid / Unpaid)
    else if (categoryCode === 'ANNUAL') {
      if (leaveType.code === 'PAID') {
        const paidBalance = await this.getBalance(employeeId, leaveType.id, year, excludeRequestId);
        const fromPaid = Math.min(remainingDays, Math.max(paidBalance, 0));

        if (fromPaid > 0) {
          items.push({
            leaveTypeId: leaveType.id,
            leaveTypeCode: leaveType.code,
            amountDays: fromPaid,
            note: 'Paid leave',
          });
          remainingDays -= fromPaid;
        }

        // Overflow paid → unpaid
        if (remainingDays > 0) {
          if (paidBalance < durationDays) {
            warnings.push(
              `Your paid leave balance (${paidBalance} days) is less than the requested ${durationDays} days. ${remainingDays} days will be deducted as unpaid leave.`,
            );
          }

          const conversions = await this.getConversions(leaveType.id);
          for (const conv of conversions) {
            if (conv.reason !== 'EXCEED_BALANCE' || remainingDays <= 0) continue;
            const unpaidType = conv.toLeaveType;
            const unpaidPolicy = await this.getActivePolicy(unpaidType.id, startDate);
            const unpaidUsed = await this.getUsedDays(employeeId, unpaidType.id, year, excludeRequestId);
            const unpaidLimit = unpaidPolicy?.annualLimitDays
              ? Number(unpaidPolicy.annualLimitDays)
              : Infinity;
            const unpaidAvailable = Math.max(unpaidLimit - unpaidUsed, 0);

            if (unpaidAvailable <= 0) {
              warnings.push(
                `Unpaid leave annual limit (${unpaidLimit} days) has been reached for this year.`,
              );
            }

            const fromUnpaid = Math.min(remainingDays, unpaidAvailable);
            if (fromUnpaid > 0) {
              items.push({
                leaveTypeId: unpaidType.id,
                leaveTypeCode: unpaidType.code,
                amountDays: fromUnpaid,
                note: 'Unpaid leave (paid balance exceeded)',
              });
              remainingDays -= fromUnpaid;
            }
          }
        }
      } else if (leaveType.code === 'UNPAID') {
        // Direct unpaid leave request
        const unpaidPolicy = await this.getActivePolicy(leaveType.id, startDate);
        const unpaidUsed = await this.getUsedDays(employeeId, leaveType.id, year, excludeRequestId);
        const unpaidLimit = unpaidPolicy?.annualLimitDays
          ? Number(unpaidPolicy.annualLimitDays)
          : Infinity;

        if (unpaidUsed + remainingDays > unpaidLimit) {
          warnings.push(
            `This request will exceed the unpaid leave annual limit (${unpaidLimit} days). Currently used: ${unpaidUsed} days.`,
          );
        }

        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: remainingDays,
          note: 'Unpaid leave',
        });
        remainingDays = 0;
      }
    }

    // 2d. All other categories (COMPENSATORY, etc.) → allocate all days directly
    else {
      items.push({
        leaveTypeId: leaveType.id,
        leaveTypeCode: leaveType.code,
        amountDays: remainingDays,
        note: leaveType.name,
      });
      remainingDays = 0;
    }

    // Safety net: if conversion chain couldn't fully allocate, add remaining as unpaid
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
        // Fallback: add as original type
        items.push({
          leaveTypeId: leaveType.id,
          leaveTypeCode: leaveType.code,
          amountDays: remainingDays,
          note: `${leaveType.name} (unallocated)`,
        });
      }
    }

    // ── Conversion notification: inform user when request is split ──
    if (items.length > 1) {
      const breakdown = items.map((i) => `${i.note}: ${i.amountDays} day(s)`).join('; ');
      warnings.unshift(
        `Your ${durationDays}-day leave request will be split across leave types: ${breakdown}.`,
      );
    }

    return {
      durationDays,
      items,
      warnings,
      canProceed: true,
    };
  }

  /**
   * Suggest an end date for leave types that have auto_calculate_end_date policy.
   * Used by the frontend to pre-fill the form (POLICY / SOCIAL leave types).
   * The user can still modify the suggested values.
   *
   * PARENTAL leave for females uses calendar days (weekends/holidays included).
   * All other leave types count working days (weekends/holidays excluded).
   */
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

    // Special handling for PARENTAL leave
    if (leaveType.code === 'PARENTAL' && parentalOptions?.employeeId) {
      const user = await this.userRepo.findOne({ where: { id: parentalOptions.employeeId } });
      const isFemale = user?.gender === UserGender.FEMALE;

      if (isFemale) {
        // Female: calendar days (weekends/holidays included)
        const numChildren = parentalOptions.numberOfChildren ?? 1;
        const entitlementDays = 180 + Math.max(0, numChildren - 1) * 30;
        const result = calculateCalendarEndDate(startDate, startSession, entitlementDays);
        return {
          suggestedEndDate: result.endDate,
          suggestedEndSession: result.endSession,
        };
      } else {
        // Male: working days (5 natural, 7 c-section)
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

    // Standard: working days (skip weekends + holidays)
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

  /**
   * Get total used (debited) days for a leave type in a year.
   * Includes pending request items as "committed" usage.
   */
  async getUsedDays(
    employeeId: number,
    leaveTypeId: number,
    year: number,
    excludeRequestId?: number,
  ): Promise<number> {
    const result = await this.balanceTxRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
      .where('tx.employee_id = :employeeId', { employeeId })
      .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('tx.period_year = :year', { year })
      .andWhere("tx.direction = 'DEBIT'")
      .getRawOne();

    const debitTotal = parseFloat(result?.total ?? '0');

    // Add days from pending requests (committed but not yet debited)
    const pendingDays = await this.getPendingItemDays(
      employeeId,
      leaveTypeId,
      year,
      excludeRequestId,
    );

    return debitTotal + pendingDays;
  }

  /**
   * Create balance debit transactions when a leave request is approved.
   * Called from the approval flow.
   */
  async debitBalanceForApproval(
    employeeId: number,
    leaveRequestId: number,
    items: LeaveRequestItem[],
    year: number,
  ): Promise<void> {
    const transactions: Partial<LeaveBalanceTransaction>[] = items.map((item) => ({
      employeeId,
      leaveTypeId: item.leaveTypeId,
      periodYear: year,
      direction: 'DEBIT',
      amountDays: Number(item.amountDays),
      sourceType: 'APPROVAL',
      sourceId: leaveRequestId,
      note: `Leave request #${leaveRequestId} approved`,
    }));

    await this.balanceTxRepo.save(transactions);
    this.logger.log(
      `Debited balance for leave request #${leaveRequestId}: ${items.length} item(s)`,
    );
  }

  /**
   * Refund balance when a leave request is cancelled (after approval).
   */
  async refundBalanceForCancellation(
    employeeId: number,
    leaveRequestId: number,
    items: LeaveRequestItem[],
    year: number,
  ): Promise<void> {
    const transactions: Partial<LeaveBalanceTransaction>[] = items.map((item) => ({
      employeeId,
      leaveTypeId: item.leaveTypeId,
      periodYear: year,
      direction: 'CREDIT',
      amountDays: Number(item.amountDays),
      sourceType: 'REFUND',
      sourceId: leaveRequestId,
      note: `Leave request #${leaveRequestId} cancelled – refund`,
    }));

    await this.balanceTxRepo.save(transactions);
    this.logger.log(
      `Refunded balance for leave request #${leaveRequestId}: ${items.length} item(s)`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Balance Initialization & Summary
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Initialize yearly paid leave balance for all active employees.
   * Creates a CREDIT ACCRUAL transaction of `annualDays` for the PAID leave type.
   * Skips employees who already have an ACCRUAL record for that year+type.
   *
   * @param year        The year to initialize (e.g. 2026)
   * @param annualDays  Total annual paid days (default: 12)
   * @returns           Summary of how many employees were credited
   */
  async initializeYearlyBalance(
    year: number,
    annualDays = 12,
  ): Promise<{ credited: number; skipped: number; total: number }> {
    // Find the PAID leave type
    const paidType = await this.leaveTypeRepo.findOne({
      where: { code: 'PAID', isActive: true },
    });
    if (!paidType) {
      throw new Error('PAID leave type not found');
    }

    // Get all active users
    const activeUsers = await this.userRepo.find({
      where: { status: UserStatus.ACTIVE },
      select: ['id'],
    });

    if (activeUsers.length === 0) {
      return { credited: 0, skipped: 0, total: 0 };
    }

    // Find which employees already have an ACCRUAL for this year+type
    const existing = await this.balanceTxRepo
      .createQueryBuilder('tx')
      .select('tx.employee_id', 'employeeId')
      .where('tx.leave_type_id = :leaveTypeId', { leaveTypeId: paidType.id })
      .andWhere('tx.period_year = :year', { year })
      .andWhere("tx.source_type = 'ACCRUAL'")
      .groupBy('tx.employee_id')
      .getRawMany();

    const existingIds = new Set(existing.map((r) => Number(r.employeeId)));

    // Create CREDIT transactions for employees without an accrual
    const toCredit = activeUsers.filter((u) => !existingIds.has(u.id));

    if (toCredit.length > 0) {
      const transactions: Partial<LeaveBalanceTransaction>[] = toCredit.map((user) => ({
        employeeId: user.id,
        leaveTypeId: paidType.id,
        periodYear: year,
        periodMonth: null,
        direction: 'CREDIT',
        amountDays: annualDays,
        sourceType: 'ACCRUAL',
        sourceId: null,
        note: `Annual paid leave allocation for ${year} (${annualDays} days)`,
      }));

      await this.balanceTxRepo.save(transactions);
    }

    this.logger.log(
      `[initializeYearlyBalance] Year ${year}: credited ${toCredit.length}, skipped ${existingIds.size} (already had accrual), total active ${activeUsers.length}`,
    );

    return {
      credited: toCredit.length,
      skipped: existingIds.size,
      total: activeUsers.length,
    };
  }

  /**
   * Initialize balance for a single employee (e.g. on activation).
   * Pro-rates based on remaining months if mid-year.
   */
  async initializeBalanceForEmployee(
    employeeId: number,
    year: number,
    annualDays = 12,
  ): Promise<{ credited: boolean; days: number }> {
    const paidType = await this.leaveTypeRepo.findOne({
      where: { code: 'PAID', isActive: true },
    });
    if (!paidType) {
      throw new Error('PAID leave type not found');
    }

    // Check if already has accrual
    const existing = await this.balanceTxRepo.findOne({
      where: {
        employeeId,
        leaveTypeId: paidType.id,
        periodYear: year,
        sourceType: 'ACCRUAL',
      },
    });

    if (existing) {
      return { credited: false, days: 0 };
    }

    // Pro-rate: remaining months / 12 * annualDays (rounded to 0.5)
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const remainingMonths = Math.max(13 - currentMonth, 1); // inclusive current month
    const proRatedDays = Math.round((remainingMonths / 12) * annualDays * 2) / 2; // round to 0.5

    await this.balanceTxRepo.save({
      employeeId,
      leaveTypeId: paidType.id,
      periodYear: year,
      periodMonth: null,
      direction: 'CREDIT',
      amountDays: proRatedDays,
      sourceType: 'ACCRUAL',
      sourceId: null,
      note: `Paid leave allocation for ${year} (${proRatedDays} days, pro-rated from month ${currentMonth})`,
    });

    this.logger.log(
      `[initializeBalanceForEmployee] Employee ${employeeId}: credited ${proRatedDays} days for ${year}`,
    );

    return { credited: true, days: proRatedDays };
  }

  /**
   * Get balance summary for an employee for a given year.
   * Returns balance info for each leave type that has transactions or a policy.
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
      totalCredit: number;
      totalDebit: number;
      pendingDays: number;
      balance: number;
      monthlyLimit: number | null;
      annualLimit: number | null;
    }[]
  > {
    // Get all active non-system leave types with their category
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { isActive: true, isSystem: false },
      relations: ['category'],
      order: { id: 'ASC' },
    });

    const result = [];

    for (const lt of leaveTypes) {
      // Sum credits
      const creditResult = await this.balanceTxRepo
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
        .where('tx.employee_id = :employeeId', { employeeId })
        .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
        .andWhere('tx.period_month IS NULL OR tx.period_month = :month', { month })
        .andWhere('tx.period_year = :year', { year })
        .andWhere("tx.direction = 'CREDIT'")
        .getRawOne();

      // Sum debits
      const debitResult = await this.balanceTxRepo
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(tx.amount_days), 0)', 'total')
        .where('tx.employee_id = :employeeId', { employeeId })
        .andWhere('tx.leave_type_id = :leaveTypeId', { leaveTypeId: lt.id })
        .andWhere('tx.period_month IS NULL OR tx.period_month = :month', { month })
        .andWhere('tx.period_year = :year', { year })
        .andWhere("tx.direction = 'DEBIT'")
        .getRawOne();

      const totalCredit = parseFloat(creditResult?.total ?? '0');
      const totalDebit = parseFloat(debitResult?.total ?? '0');

      // Include pending request items as committed usage
      const pendingDays = await this.getPendingItemDays(employeeId, lt.id, year);

      // Get annual limit from policy
      const policy = await this.getActivePolicy(lt.id, `${year}-01-01`);

      result.push({
        leaveTypeId: Number(lt.id),
        leaveTypeCode: lt.code,
        leaveTypeName: lt.name,
        categoryCode: lt.category?.code ?? '',
        categoryName: lt.category?.name ?? '',
        totalCredit,
        totalDebit: totalDebit + pendingDays,
        pendingDays,
        balance: totalCredit - totalDebit - pendingDays,
        monthlyLimit: policy?.monthlyLimitDays ? Number(policy.monthlyLimitDays) : null,
        annualLimit: policy?.annualLimitDays ? Number(policy.annualLimitDays) : null,
      });
    }

    return result;
  }
}
