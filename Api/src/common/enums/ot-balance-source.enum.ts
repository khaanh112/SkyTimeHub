export enum OtBalanceSource {
  /** Initial reservation credit written when a plan is submitted */
  OT_PLAN_CREATED = 'OT_PLAN_CREATED',
  /** Reversal debit written when a plan's employee list is re-edited (old rows reversed) */
  OT_PLAN_UPDATED = 'OT_PLAN_UPDATED',
  /** Reversal debit written when an approver rejects a plan */
  OT_PLAN_REJECTED = 'OT_PLAN_REJECTED',
  /** Reversal debit written when the creator cancels a plan */
  OT_PLAN_CANCELLED = 'OT_PLAN_CANCELLED',
  /** Reversal debit that sweeps the plan reservation when a check-in is confirmed */
  OT_PLAN_RECONCILED = 'OT_PLAN_RECONCILED',
  /** Actual OT hours credited after check-in is approved */
  OT_CHECKIN_APPROVED = 'OT_CHECKIN_APPROVED',
  ADJUSTMENT = 'ADJUSTMENT',
  CARRYOVER = 'CARRYOVER',
}
