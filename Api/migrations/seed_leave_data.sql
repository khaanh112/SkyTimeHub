-- Seed data: leave_categories, leave_types, leave_type_policies, leave_type_conversions
-- Calendar overrides (Vietnam 2026 public holidays)
-- Run this AFTER all migration scripts

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 1. Leave Categories
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.leave_categories (code, name)
VALUES
  ('ANNUAL',        'Annual Leave'),
  ('COMPENSATORY',  'Compensatory Leave'),
  ('POLICY',        'Policy Leave'),
  ('SOCIAL',        'Social Benefits Leave')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 2. Leave Types
-- ═══════════════════════════════════════════════════════════

-- Annual
INSERT INTO public.leave_types (category_id, code, name, requires_document, requires_comp_working_date, is_system, is_active)
VALUES
  ((SELECT id FROM leave_categories WHERE code = 'ANNUAL'),
   'PAID',   'Paid Leave',   false, false, false, true),
  ((SELECT id FROM leave_categories WHERE code = 'ANNUAL'),
   'UNPAID', 'Unpaid Leave', false, false, false, true)
ON CONFLICT (code) DO NOTHING;

-- Compensatory
INSERT INTO public.leave_types (category_id, code, name, requires_document, requires_comp_working_date, is_system, is_active)
VALUES
  ((SELECT id FROM leave_categories WHERE code = 'COMPENSATORY'),
   'COMP', 'Compensatory Leave', false, true, false, true)
ON CONFLICT (code) DO NOTHING;

-- Policy
INSERT INTO public.leave_types (category_id, code, name, requires_document, requires_comp_working_date, is_system, is_active)
VALUES
  ((SELECT id FROM leave_categories WHERE code = 'POLICY'),
   'MARRIAGE',        'Marriage Leave',         false, false, false, true),
  ((SELECT id FROM leave_categories WHERE code = 'POLICY'),
   'CHILD_MARRIAGE',  'Child Marriage Leave',   false, false, false, true),
  ((SELECT id FROM leave_categories WHERE code = 'POLICY'),
   'BEREAVEMENT',     'Bereavement Leave',      false, false, false, true)
ON CONFLICT (code) DO NOTHING;

-- Social Benefits
INSERT INTO public.leave_types (category_id, code, name, requires_document, requires_comp_working_date, is_system, is_active)
VALUES
  ((SELECT id FROM leave_categories WHERE code = 'SOCIAL'),
   'SICK',       'Sick Leave',       true, false, false, true),
  ((SELECT id FROM leave_categories WHERE code = 'SOCIAL'),
   'PARENTAL',   'Parental Leave',   true, false, false, true),
  ((SELECT id FROM leave_categories WHERE code = 'SOCIAL'),
   'ANTENATAL',  'Antenatal Leave',  true, false, false, true)
ON CONFLICT (code) DO NOTHING;

-- System-generated (for payroll cutoff auto-conversion)
INSERT INTO public.leave_types (category_id, code, name, requires_document, requires_comp_working_date, is_system, is_active)
VALUES
  (NULL, 'SYS_UNPAID', 'System Unpaid Leave (auto-generated)', false, false, true, true)
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 3. Leave Type Policies  (effective 2026-01-01)
-- ═══════════════════════════════════════════════════════════

-- Paid Leave: 12 days/year (1/month accrual), no negative, no max per request
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'PAID'),
   '2026-01-01', NULL, 0.5, false, NULL, NULL, false);

-- Unpaid Leave: max 30 days/year
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'UNPAID'),
   '2026-01-01', NULL, 0.5, false, NULL, 30, false);

-- Compensatory Leave: allow negative up to -16h (2 days)
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'COMP'),
   '2026-01-01', NULL, 0.5, true, 2, NULL, false);

-- Marriage Leave: max 3 days per request, auto-calc end date
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'MARRIAGE'),
   '2026-01-01', 3, 0.5, false, NULL, NULL, true);

-- Child Marriage Leave: max 1 day per request, auto-calc end date
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'CHILD_MARRIAGE'),
   '2026-01-01', 1, 0.5, false, NULL, NULL, true);

-- Bereavement Leave: max 3 days per request, auto-calc end date
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'BEREAVEMENT'),
   '2026-01-01', 3, 0.5, false, NULL, NULL, true);

-- Sick Leave: max 180 days per year (BHXH), requires_document, auto-calc end date
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'SICK'),
   '2026-01-01', NULL, 0.5, false, NULL, 180, true);

-- Parental Leave: max 180 days per request (6 months), requires_document, auto-calc end date
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'PARENTAL'),
   '2026-01-01', 180, 0.5, false, NULL, NULL, true);

-- Antenatal Leave: max 5 times/pregnancy, auto-calc end date
INSERT INTO public.leave_type_policies
  (leave_type_id, effective_from, max_per_request_days, min_duration_days,
   allow_negative, max_negative_limit_days, annual_limit_days, auto_calculate_end_date)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'ANTENATAL'),
   '2026-01-01', 1, 0.5, false, NULL, NULL, true);

-- ═══════════════════════════════════════════════════════════
-- 4. Leave Type Conversions  (excess routing)
-- ═══════════════════════════════════════════════════════════

-- Policy types → Paid Leave (when exceed max_per_request)
INSERT INTO public.leave_type_conversions (from_leave_type_id, to_leave_type_id, priority, reason)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'MARRIAGE'),
   (SELECT id FROM leave_types WHERE code = 'PAID'), 1, 'EXCEED_MAX_PER_REQUEST'),
  ((SELECT id FROM leave_types WHERE code = 'CHILD_MARRIAGE'),
   (SELECT id FROM leave_types WHERE code = 'PAID'), 1, 'EXCEED_MAX_PER_REQUEST'),
  ((SELECT id FROM leave_types WHERE code = 'BEREAVEMENT'),
   (SELECT id FROM leave_types WHERE code = 'PAID'), 1, 'EXCEED_MAX_PER_REQUEST');

-- Social Benefits types → Paid Leave (when exceed max_per_request)
INSERT INTO public.leave_type_conversions (from_leave_type_id, to_leave_type_id, priority, reason)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'SICK'),
   (SELECT id FROM leave_types WHERE code = 'PAID'), 1, 'EXCEED_MAX_PER_REQUEST'),
  ((SELECT id FROM leave_types WHERE code = 'PARENTAL'),
   (SELECT id FROM leave_types WHERE code = 'PAID'), 1, 'EXCEED_MAX_PER_REQUEST'),
  ((SELECT id FROM leave_types WHERE code = 'ANTENATAL'),
   (SELECT id FROM leave_types WHERE code = 'PAID'), 1, 'EXCEED_MAX_PER_REQUEST');

-- Paid Leave → Unpaid Leave (when paid balance exhausted)
INSERT INTO public.leave_type_conversions (from_leave_type_id, to_leave_type_id, priority, reason)
VALUES
  ((SELECT id FROM leave_types WHERE code = 'PAID'),
   (SELECT id FROM leave_types WHERE code = 'UNPAID'), 1, 'EXCEED_BALANCE');

-- ═══════════════════════════════════════════════════════════
-- 5. Calendar Overrides  (Vietnam 2026 public holidays)
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.calendar_overrides (date, type, name, year)
VALUES
  -- Tết Dương Lịch
  ('2026-01-01', 'HOLIDAY', 'New Year''s Day', 2026),
  -- Tết Nguyên Đán 2026 (Feb 16 = mùng 1)
  ('2026-02-14', 'HOLIDAY', 'Tết Nguyên Đán (29 Tết)',  2026),
  ('2026-02-15', 'HOLIDAY', 'Tết Nguyên Đán (30 Tết)',  2026),
  ('2026-02-16', 'HOLIDAY', 'Tết Nguyên Đán (Mùng 1)',  2026),
  ('2026-02-17', 'HOLIDAY', 'Tết Nguyên Đán (Mùng 2)',  2026),
  ('2026-02-18', 'HOLIDAY', 'Tết Nguyên Đán (Mùng 3)',  2026),
  -- Giỗ Tổ Hùng Vương (10/3 ÂL ≈ Apr 26, 2026)
  ('2026-04-26', 'HOLIDAY', 'Hung Kings Festival', 2026),
  -- Ngày Giải phóng miền Nam 30/4
  ('2026-04-30', 'HOLIDAY', 'Reunification Day', 2026),
  -- Ngày Quốc tế Lao động 1/5
  ('2026-05-01', 'HOLIDAY', 'Labour Day', 2026),
  -- Quốc khánh 2/9
  ('2026-09-02', 'HOLIDAY', 'National Day', 2026)
ON CONFLICT (date) DO NOTHING;

COMMIT;
