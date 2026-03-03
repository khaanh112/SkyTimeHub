-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Monthly Accrual System
--
-- Changes:
--   1. Ensure period_month column exists on leave_balance_transactions
--      (already exists as nullable int — no DDL change needed)
--   2. Add indexes for month-level queries
--   3. Convert existing single-year ACCRUAL records into 12 monthly
--      MONTHLY_ACCRUAL records (data migration)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Index for per-month querying ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_balance_tx_employee_type_year_month
  ON leave_balance_transactions (employee_id, leave_type_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_balance_tx_source
  ON leave_balance_transactions (source_id, source_type, direction);

-- ── 2. Data migration: split existing annual ACCRUAL → monthly ──────
-- For each existing ACCRUAL record (period_month IS NULL), create 12
-- MONTHLY_ACCRUAL records (1 per month) and mark the original as
-- superseded by updating its source_type.
--
-- This is IDEMPOTENT: only processes ACCRUAL records that have NOT
-- already been split (i.e. no MONTHLY_ACCRUAL exists for that
-- employee + leave_type + year).
DO $$
DECLARE
  rec RECORD;
  monthly_rate NUMERIC(7,2);
  m INT;
BEGIN
  FOR rec IN
    SELECT t.id, t.employee_id, t.leave_type_id, t.period_year, t.amount_days
    FROM leave_balance_transactions t
    WHERE t.source_type = 'ACCRUAL'
      AND t.direction = 'CREDIT'
      AND t.period_month IS NULL
      -- Only process if no MONTHLY_ACCRUAL exists yet for same employee/type/year
      AND NOT EXISTS (
        SELECT 1
        FROM leave_balance_transactions t2
        WHERE t2.employee_id = t.employee_id
          AND t2.leave_type_id = t.leave_type_id
          AND t2.period_year = t.period_year
          AND t2.source_type = 'MONTHLY_ACCRUAL'
      )
  LOOP
    -- Monthly rate = annual / 12 (round to 2 decimals)
    monthly_rate := ROUND(rec.amount_days / 12, 2);

    -- Create 12 monthly accrual records
    FOR m IN 1..12 LOOP
      INSERT INTO leave_balance_transactions
        (employee_id, leave_type_id, period_year, period_month, direction,
         amount_days, source_type, source_id, note, created_at)
      VALUES
        (rec.employee_id, rec.leave_type_id, rec.period_year, m, 'CREDIT',
         monthly_rate, 'MONTHLY_ACCRUAL', NULL,
         FORMAT('Migrated from annual ACCRUAL: %s/%s (%s day)',
                rec.period_year, LPAD(m::TEXT, 2, '0'), monthly_rate),
         NOW());
    END LOOP;

    -- Mark original ACCRUAL as superseded (keep for audit trail)
    UPDATE leave_balance_transactions
    SET source_type = 'ACCRUAL_SUPERSEDED',
        note = COALESCE(note, '') || ' [migrated to MONTHLY_ACCRUAL]'
    WHERE id = rec.id;
  END LOOP;
END $$;

-- ── 3. Backfill period_month on existing DEBIT/REFUND transactions ──
-- For DEBIT transactions that have period_month IS NULL, try to infer
-- the month from the linked leave request's start_date.
UPDATE leave_balance_transactions t
SET period_month = EXTRACT(MONTH FROM lr.start_date)::INT
FROM leave_requests lr
WHERE t.source_id = lr.id
  AND t.period_month IS NULL
  AND t.source_type IN ('APPROVAL', 'REFUND')
  AND t.source_id IS NOT NULL;
