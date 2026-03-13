-- Migration: Add missing ot_balance_source enum values
-- Context:
--   OT_PLAN_UPDATED    — written as a DEBIT when a plan's employees are re-edited (reverses old reservation)
--   OT_PLAN_REJECTED   — written as a DEBIT when an approver rejects a plan (reverses reservation)
--   OT_PLAN_CANCELLED  — written as a DEBIT when the creator cancels a plan (reverses reservation)
--   OT_PLAN_RECONCILED — written as a DEBIT that sweeps the plan reservation when a check-in is confirmed
-- These values were referenced in code but were never added to the DB enum,
-- causing runtime constraint violations on any reject/cancel/update/reconcile operation.

ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'OT_PLAN_UPDATED';
ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'OT_PLAN_REJECTED';
ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'OT_PLAN_CANCELLED';
ALTER TYPE ot_balance_source ADD VALUE IF NOT EXISTS 'OT_PLAN_RECONCILED';
