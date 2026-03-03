-- Update PAID leave policy: 12 days/year, 1 day/month accrual (cumulative)
-- Update UNPAID leave policy: ensure 30 days/year annual limit is set
-- Run this AFTER seed_leave_data.sql

BEGIN;

-- PAID Leave: set annual_limit_days = 12, monthly_limit_days = 1 (accrual rate per month)
UPDATE leave_type_policies
SET annual_limit_days = 12,
    monthly_limit_days = 1
WHERE leave_type_id = (SELECT id FROM leave_types WHERE code = 'PAID')
  AND effective_from = '2026-01-01';

-- UNPAID Leave: ensure annual_limit_days = 30 (soft limit, exceeding only triggers warning)
UPDATE leave_type_policies
SET annual_limit_days = 30
WHERE leave_type_id = (SELECT id FROM leave_types WHERE code = 'UNPAID')
  AND effective_from = '2026-01-01';

COMMIT;
