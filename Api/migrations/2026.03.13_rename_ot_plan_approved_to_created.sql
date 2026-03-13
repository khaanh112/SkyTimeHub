-- Migration: Rename OT_PLAN_APPROVED → OT_PLAN_CREATED in ot_balance_source enum
-- Context: balance credits are written at plan creation time (not at approval time),
-- so OT_PLAN_CREATED is semantically correct. All existing OT_PLAN_APPROVED credits
-- were written at creation time under the old name, so they are renamed accordingly.

-- Step 1: Add the new enum value
ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'OT_PLAN_CREATED';

-- Step 2: Rename all existing OT_PLAN_APPROVED records to OT_PLAN_CREATED
-- (These were all written at plan creation time — just under the old name)
UPDATE ot_balance_transactions
SET source_type = 'OT_PLAN_CREATED'
WHERE source_type = 'OT_PLAN_APPROVED';
