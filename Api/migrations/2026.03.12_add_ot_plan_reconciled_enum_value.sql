-- Add missing OT_PLAN_RECONCILED value to ot_balance_source enum
-- This value is used when a reserved plan credit is reversed at check-in approval time.
ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'OT_PLAN_RECONCILED';
