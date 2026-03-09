-- ============================================================
-- Migration: Create OT Management tables
-- Date: 2026-03-09
-- Description: Add ot_plans, ot_plan_employees, ot_checkins,
--              ot_balance_transactions tables and related enums
-- ============================================================

-- ── Enum types ───────────────────────────────────────────────

CREATE TYPE ot_plan_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE ot_day_type AS ENUM ('weekday', 'weekend', 'holiday');
CREATE TYPE ot_time_type AS ENUM ('day', 'night', 'mixed');
CREATE TYPE ot_checkin_status AS ENUM ('pending', 'checked_in', 'checked_out', 'leader_approved', 'leader_rejected', 'missed');
CREATE TYPE ot_compensatory_method AS ENUM ('paid', 'comp_leave');
CREATE TYPE ot_balance_source AS ENUM ('OT_PLAN_APPROVED', 'OT_CHECKIN_APPROVED', 'OT_PLAN_CANCELLED', 'OT_PLAN_REJECTED', 'ADJUSTMENT', 'CARRYOVER');
CREATE TYPE ot_balance_direction AS ENUM ('CREDIT', 'DEBIT');

-- ── Add new values to existing enums ─────────────────────────

-- EmailType (email_queue.type) — already added via application code if
-- using TypeORM synchronize; include here for manual migration:
-- ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'OT_PLAN_SUBMITTED';
-- ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'OT_PLAN_APPROVED';
-- ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'OT_PLAN_REJECTED';
-- ALTER TYPE email_type ADD VALUE IF NOT EXISTS 'OT_ASSIGNMENT_APPROVED';

-- CompTxSource (comp_balance_transactions.source_type):
-- ALTER TYPE comp_tx_source ADD VALUE IF NOT EXISTS 'OT_CHECKIN_APPROVED';

-- ── ot_plans ─────────────────────────────────────────────────

CREATE TABLE ot_plans (
    id                      SERIAL PRIMARY KEY,
    title                   VARCHAR(100) NOT NULL,
    description             TEXT,
    department_id           INT NOT NULL
        REFERENCES departments(id) ON DELETE RESTRICT,
    created_by              INT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    approver_id             INT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    total_duration_minutes  INT NOT NULL DEFAULT 0,
    status                  ot_plan_status NOT NULL DEFAULT 'pending',
    rejected_reason         TEXT,
    version                 INT NOT NULL DEFAULT 1,
    approved_at             TIMESTAMPTZ,
    rejected_at             TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_plans_dept_status ON ot_plans (department_id, status);
CREATE INDEX idx_ot_plans_created_by ON ot_plans (created_by);
CREATE INDEX idx_ot_plans_approver_status ON ot_plans (approver_id, status);

-- ── ot_plan_employees ────────────────────────────────────────

CREATE TABLE ot_plan_employees (
    id                  BIGSERIAL PRIMARY KEY,
    ot_plan_id          INT NOT NULL
        REFERENCES ot_plans(id) ON DELETE CASCADE,
    employee_id         INT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ NOT NULL,
    duration_minutes    INT NOT NULL,
    planned_task        VARCHAR(150) NOT NULL,
    day_type            ot_day_type NOT NULL,
    ot_time_type        ot_time_type NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ot_pe_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_ot_pe_plan ON ot_plan_employees (ot_plan_id);
CREATE INDEX idx_ot_pe_employee_time ON ot_plan_employees (employee_id, start_time, end_time);

-- ── ot_checkins ──────────────────────────────────────────────

CREATE TABLE ot_checkins (
    id                      BIGSERIAL PRIMARY KEY,
    ot_plan_employee_id     BIGINT NOT NULL
        REFERENCES ot_plan_employees(id) ON DELETE CASCADE,
    check_in_at             TIMESTAMPTZ,
    check_out_at            TIMESTAMPTZ,
    actual_duration_minutes INT,
    work_output             TEXT,
    compensatory_method     ot_compensatory_method,
    status                  ot_checkin_status NOT NULL DEFAULT 'pending',
    leader_approved_at      TIMESTAMPTZ,
    leader_approved_by      INT
        REFERENCES users(id) ON DELETE SET NULL,
    rejected_reason         TEXT,
    version                 INT NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_checkins_plan_emp ON ot_checkins (ot_plan_employee_id);
CREATE INDEX idx_ot_checkins_status ON ot_checkins (status);

-- ── ot_balance_transactions ──────────────────────────────────

CREATE TABLE ot_balance_transactions (
    id              BIGSERIAL PRIMARY KEY,
    employee_id     INT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    direction       VARCHAR(10) NOT NULL,
    amount_minutes  INT NOT NULL,
    source_type     ot_balance_source NOT NULL,
    source_id       BIGINT,
    period_year     INT NOT NULL,
    period_month    INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_date     DATE,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_bal_emp_year_month ON ot_balance_transactions (employee_id, period_year, period_month);
CREATE INDEX idx_ot_bal_emp_date ON ot_balance_transactions (employee_id, period_date);
CREATE INDEX idx_ot_bal_source ON ot_balance_transactions (source_type, source_id);
