-- ════════════════════════════════════════════════════════════════════
-- Migration: Reserve Flow & Period Columns
-- Adds period_year/period_month to leave_request_items,
-- standardises source_type enum on leave_balance_transactions,
-- and adds proper constraints/indexes.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- A. leave_request_items — add period columns
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE leave_request_items
  ADD COLUMN IF NOT EXISTS period_year  INT,
  ADD COLUMN IF NOT EXISTS period_month INT;

-- Back-fill existing rows (best-effort: derive from parent request start_date)
UPDATE leave_request_items lri
SET period_year  = EXTRACT(YEAR  FROM lr.start_date)::INT,
    period_month = EXTRACT(MONTH FROM lr.start_date)::INT
FROM leave_requests lr
WHERE lri.leave_request_id = lr.id
  AND lri.period_year IS NULL;

-- Now make columns NOT NULL
ALTER TABLE leave_request_items
  ALTER COLUMN period_year  SET NOT NULL,
  ALTER COLUMN period_month SET NOT NULL;

-- CHECK constraint: month must be 1–12
ALTER TABLE leave_request_items
  ADD CONSTRAINT chk_lri_period_month CHECK (period_month BETWEEN 1 AND 12);

-- Unique: no duplicate item per (request, leave_type, year, month)
ALTER TABLE leave_request_items
  ADD CONSTRAINT uq_lri_request_type_period
  UNIQUE (leave_request_id, leave_type_id, period_year, period_month);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lri_request_id
  ON leave_request_items (leave_request_id);

CREATE INDEX IF NOT EXISTS idx_lri_period
  ON leave_request_items (period_year, period_month);


-- ──────────────────────────────────────────────────────────────────
-- B. leave_balance_transactions — standardise source_type + constraints
-- ──────────────────────────────────────────────────────────────────

-- Make period_month NOT NULL (back-fill with 1 where null)
UPDATE leave_balance_transactions
SET period_month = 1
WHERE period_month IS NULL;

ALTER TABLE leave_balance_transactions
  ALTER COLUMN period_month SET NOT NULL;

-- CHECK constraint: month must be 1–12
ALTER TABLE leave_balance_transactions
  ADD CONSTRAINT chk_lbt_period_month CHECK (period_month BETWEEN 1 AND 12);

-- Migrate old source_type values to new enum names
UPDATE leave_balance_transactions SET source_type = 'RESERVE'        WHERE source_type = 'RESERVED';
UPDATE leave_balance_transactions SET source_type = 'MONTHLY_ACCRUAL' WHERE source_type = 'ACCRUAL';

-- Unique: one monthly accrual per employee+type+year+month
-- Using partial unique index (PostgreSQL specific)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lbt_monthly_accrual
  ON leave_balance_transactions (employee_id, leave_type_id, period_year, period_month)
  WHERE source_type = 'MONTHLY_ACCRUAL';

-- Main lookup index
CREATE INDEX IF NOT EXISTS idx_lbt_emp_type_period
  ON leave_balance_transactions (employee_id, leave_type_id, period_year, period_month);

-- Source tracing index
CREATE INDEX IF NOT EXISTS idx_lbt_source
  ON leave_balance_transactions (source_type, source_id);

COMMIT;
