-- =============================================================
-- Migration: Refactor OT day-type enum + introduce item tables
-- =============================================================
-- Run order matters.  Execute inside a transaction.
-- =============================================================

BEGIN;

-- ─── 1. Drop ALL objects that depend on ot_day_type enum ───────────────────
--  This makes the migration fully idempotent regardless of prior partial runs.
--  Tables will be recreated below with the new enum.

--  Drop ot_plan_employee_items (going away permanently)
DROP TABLE IF EXISTS ot_plan_employee_items;

--  Drop ot_checkin_items (will be recreated with new enum)
DROP TABLE IF EXISTS ot_checkin_items;

--  Drop ot_types CASCADE (removes FK from ot_balance_transactions.ot_type_id)
DROP TABLE IF EXISTS ot_types CASCADE;

--  Drop day_type / ot_type_id / actual_date from ot_balance_transactions
--  (will be re-added after new enum is in place)
ALTER TABLE ot_balance_transactions
  DROP COLUMN IF EXISTS day_type,
  DROP COLUMN IF EXISTS ot_type_id,
  DROP COLUMN IF EXISTS actual_date;

--  Drop legacy day_type / ot_time_type from ot_plan_employees
ALTER TABLE ot_plan_employees
  DROP COLUMN IF EXISTS day_type,
  DROP COLUMN IF EXISTS ot_time_type;

-- ─── 2. Rebuild ot_day_type enum (6 values) ────────────────────────────────
--  Old values: weekday, weekend, holiday,
--              weekday_night_no_day_ot, weekday_night_with_day_ot,
--              weekend_night, holiday_night
--  New values: weekday, weekday_night, weekend, weekend_night, holiday, holiday_night
--  All dependents are dropped above — rename is now safe.

ALTER TYPE ot_day_type RENAME TO ot_day_type_old;

CREATE TYPE ot_day_type AS ENUM (
  'weekday',
  'weekday_night',
  'weekend',
  'weekend_night',
  'holiday',
  'holiday_night'
);

DROP TYPE ot_day_type_old;

-- ─── 3. Add ot_plan_reconciled to ot_balance_source enum ───────────────────

ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'ot_plan_reconciled';

-- ─── 4. Create ot_types lookup table ────────────────────────────────────────

CREATE TABLE ot_types (
  id          BIGSERIAL    PRIMARY KEY,
  day_type    ot_day_type  NOT NULL,
  description VARCHAR(255),
  CONSTRAINT uq_ot_types_day_type UNIQUE (day_type)
);

INSERT INTO ot_types (day_type, description) VALUES
  ('weekday',       'Weekday daytime OT (06:00–22:00, Mon–Fri)'),
  ('weekday_night', 'Weekday night OT (22:00–06:00, Mon–Fri)'),
  ('weekend',       'Weekend daytime OT (06:00–22:00, Sat–Sun)'),
  ('weekend_night', 'Weekend night OT (22:00–06:00, Sat–Sun)'),
  ('holiday',       'Public holiday daytime OT (06:00–22:00)'),
  ('holiday_night', 'Public holiday night OT (22:00–06:00)');

-- ─── 5. Create ot_checkin_items table ──────────────────────────────────────

CREATE TABLE ot_checkin_items (
  id               BIGSERIAL    PRIMARY KEY,
  ot_checkin_id    BIGINT       NOT NULL,
  employee_id      INT          NOT NULL,
  ot_type_id       BIGINT       NOT NULL,
  day_type         ot_day_type  NOT NULL,
  start_time       TIMESTAMPTZ  NOT NULL,
  end_time         TIMESTAMPTZ  NOT NULL,
  duration_minutes INT          NOT NULL,
  actual_date      DATE         NOT NULL,
  attributed_date  DATE         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_ot_ci_checkin FOREIGN KEY (ot_checkin_id)
    REFERENCES ot_checkins (id) ON DELETE CASCADE,
  CONSTRAINT fk_ot_ci_ot_type FOREIGN KEY (ot_type_id)
    REFERENCES ot_types (id) ON DELETE RESTRICT
);

CREATE INDEX idx_ot_ci_checkin        ON ot_checkin_items (ot_checkin_id);
CREATE INDEX idx_ot_ci_emp_attributed ON ot_checkin_items (employee_id, attributed_date);

-- ─── 6. Add new columns to ot_balance_transactions ──────────────────────────

ALTER TABLE ot_balance_transactions
  ADD COLUMN day_type    ot_day_type NULL,
  ADD COLUMN ot_type_id  BIGINT      NULL,
  ADD COLUMN actual_date DATE        NULL;

ALTER TABLE ot_balance_transactions
  ADD CONSTRAINT fk_ot_bal_ot_type FOREIGN KEY (ot_type_id)
    REFERENCES ot_types (id) ON DELETE RESTRICT;

-- ─── 7. Drop ot_time_type enum (no longer used) ─────────────────────────────

DROP TYPE IF EXISTS ot_time_type;

COMMIT;
