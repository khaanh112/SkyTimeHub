-- Migration: OT balance now written at plan creation time (not approve time)
-- This reverses orphaned OT_PLAN_APPROVED credits that were written during the old
-- approveOtPlan flow and have no corresponding reconcile/cancel/reject debit.

-- Add OT_PLAN_REJECTED to the ot_balance_source enum if not already present
ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'OT_PLAN_REJECTED';

-- Reverse orphaned OT_PLAN_APPROVED credits from the old approve-time flow.
-- These are credits whose source_id (otPlanEmployee.id) has no matching
-- DEBIT transaction of source_type RECONCILED, CANCELLED, or REJECTED.
INSERT INTO ot_balance_transactions (
  employee_id,
  direction,
  amount_minutes,
  source_type,
  source_id,
  period_year,
  period_month,
  period_date,
  note,
  created_at
)
SELECT
  t.employee_id,
  'DEBIT',
  t.amount_minutes,
  'OT_PLAN_CANCELLED',
  t.source_id,
  t.period_year,
  t.period_month,
  t.period_date,
  'Migration: reverse orphan plan credit from old approve-time flow',
  NOW()
FROM ot_balance_transactions t
WHERE t.source_type = 'OT_PLAN_APPROVED'
  AND NOT EXISTS (
    SELECT 1
    FROM ot_balance_transactions t2
    WHERE t2.source_id = t.source_id
      AND t2.source_type IN ('OT_PLAN_RECONCILED', 'OT_PLAN_CANCELLED', 'OT_PLAN_REJECTED')
  );
