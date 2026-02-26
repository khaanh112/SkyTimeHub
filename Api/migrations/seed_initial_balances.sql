-- Seed initial leave balance for all active users
-- Run this AFTER seed_leave_data.sql
-- This creates the yearly ACCRUAL CREDIT (12 days paid leave) for 2026

BEGIN;

INSERT INTO public.leave_balance_transactions
  (employee_id, leave_type_id, period_year, period_month, direction, amount_days, source_type, source_id, note)
SELECT
  u.id,
  (SELECT id FROM public.leave_types WHERE code = 'PAID' LIMIT 1),
  2026,
  NULL,
  'CREDIT',
  12,
  'ACCRUAL',
  NULL,
  'Annual paid leave allocation for 2026 (12 days)'
FROM public.users u
WHERE u.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.leave_balance_transactions t
    WHERE t.employee_id = u.id
      AND t.leave_type_id = (SELECT id FROM public.leave_types WHERE code = 'PAID' LIMIT 1)
      AND t.period_year = 2026
      AND t.source_type = 'ACCRUAL'
  );

COMMIT;
