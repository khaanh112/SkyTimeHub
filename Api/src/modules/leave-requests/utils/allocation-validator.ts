/**
 * Validation guards for leave request allocations.
 *
 * These guards catch internal bugs (duplicate buckets, sum mismatches)
 * before they hit the database unique constraint or cause silent data errors.
 */

export interface AllocationEntry {
  leaveTypeId: number;
  year: number;
  month: number;
  amountDays: number;
}

/**
 * P1-5: Ensure no two allocations share the same (leaveTypeId, year, month) key.
 *
 * The DB enforces `UNIQUE(leave_request_id, leave_type_id, period_year, period_month)`
 * but catching duplicates earlier gives a clearer error and prevents a 500
 * from a constraint violation.
 *
 * @throws Error with a descriptive "BUG:" prefix if a duplicate is found.
 */
export function validateAllocationsNoDuplicateBucket(
  allocations: AllocationEntry[],
): void {
  const seen = new Set<string>();
  for (const a of allocations) {
    const key = `${a.leaveTypeId}-${a.year}-${a.month}`;
    if (seen.has(key)) {
      throw new Error(
        `BUG: duplicate allocation bucket detected — ` +
        `leaveTypeId=${a.leaveTypeId}, year=${a.year}, month=${a.month}. ` +
        `Each (leaveTypeId, year, month) must be unique within a request.`,
      );
    }
    seen.add(key);
  }
}

/**
 * P1-6: Assert that the sum of allocation amounts equals the expected total duration.
 *
 * Uses 0.5-day rounding to tolerate floating-point imprecision.
 *
 * @throws Error if the sum deviates from expected by more than 0.01 days.
 */
export function assertAllocationSum(
  allocations: { amountDays: number }[],
  expectedDurationDays: number,
): void {
  const total = allocations.reduce((sum, a) => sum + Number(a.amountDays), 0);
  const rounded = Math.round(total * 2) / 2;
  const expectedRounded = Math.round(expectedDurationDays * 2) / 2;

  if (Math.abs(rounded - expectedRounded) > 0.01) {
    throw new Error(
      `BUG: allocations sum mismatch — ` +
      `sum=${rounded}, expected=${expectedRounded}. ` +
      `The allocation logic produced an inconsistent total.`,
    );
  }
}
