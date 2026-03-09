-- ============================================================
-- Migration: Create system_settings table
-- Date: 2026-03-09
-- Description: Key-value store for policy configurations
--              (OT policy, Leave policy, etc.)
-- ============================================================

CREATE TABLE system_settings (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(100) NOT NULL,
    key             VARCHAR(100) NOT NULL UNIQUE,
    value           TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default OT policy values
INSERT INTO system_settings (category, key, value, description) VALUES
    ('ot_policy', 'max_ot_hours_per_day',         '4',   'Max OT hours per day (regular days)'),
    ('ot_policy', 'max_ot_hours_per_day_holiday',  '8',   'Max OT hours per day (rest days & holidays)'),
    ('ot_policy', 'max_ot_hours_per_month',        '40',  'Max OT hours per month'),
    ('ot_policy', 'max_ot_hours_per_year',         '200', 'Max OT hours per year');

-- Seed default Leave policy values
INSERT INTO system_settings (category, key, value, description) VALUES
    ('leave_policy', 'min_comp_leave_duration_hours', '4', 'Min compensatory leave duration per request (hours)');
