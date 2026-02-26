BEGIN;

-- enum session
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_session') THEN
    CREATE TYPE public.leave_session AS ENUM ('AM','PM');
  END IF;
END $$;

-- fill default cho data cũ
UPDATE public.leave_requests
SET start_session = COALESCE(start_session, 'AM'),
    end_session   = COALESCE(end_session, 'PM');

-- đổi type sang enum
ALTER TABLE public.leave_requests
  ALTER COLUMN start_session TYPE public.leave_session USING start_session::public.leave_session,
  ALTER COLUMN end_session   TYPE public.leave_session USING end_session::public.leave_session;

ALTER TABLE public.leave_requests
  ALTER COLUMN start_session SET NOT NULL,
  ALTER COLUMN end_session   SET NOT NULL;

-- rule ngày hợp lệ (KHÔNG dùng IF NOT EXISTS ở đây)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_leave_request_date_order'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT ck_leave_request_date_order
      CHECK (end_date >= start_date);
  END IF;
END $$;

-- rule session hợp lệ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_leave_request_session_order'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT ck_leave_request_session_order
      CHECK (
        (end_date > start_date)
        OR (start_session = 'AM' AND end_session IN ('AM','PM'))
        OR (start_session = 'PM' AND end_session = 'PM')
      );
  END IF;
END $$;

-- duration_days
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS duration_days NUMERIC(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_leave_duration_step'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT ck_leave_duration_step
      CHECK (duration_days IS NULL OR (duration_days * 2) = floor(duration_days * 2));
  END IF;
END $$;

-- slot range
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS start_slot INT GENERATED ALWAYS AS (
    ((start_date - DATE '2000-01-01') * 2) + (CASE WHEN start_session='PM' THEN 1 ELSE 0 END)
  ) STORED;

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS end_slot INT GENERATED ALWAYS AS (
    ((end_date - DATE '2000-01-01') * 2) + (CASE WHEN end_session='PM' THEN 1 ELSE 0 END)
  ) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_leave_slot_order'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT ck_leave_slot_order
      CHECK (end_slot >= start_slot);
  END IF;
END $$;

-- extension + exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'excl_leave_no_overlap_active') THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT excl_leave_no_overlap_active
      EXCLUDE USING gist (
        user_id WITH =,
        int4range(start_slot, end_slot + 1, '[)') WITH &&
      )
      WHERE (status IN ('pending','approved'));
  END IF;
END $$;

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS public.leave_categories (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,     -- ANNUAL, POLICY, SOCIAL, COMPENSATORY
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_types (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES public.leave_categories(id) ON DELETE SET NULL,
  code VARCHAR(50) UNIQUE NOT NULL,     -- PAID, UNPAID, POLICY_X, SICK, MATERNITY, COMP...
  name VARCHAR(100) NOT NULL,

  requires_document BOOLEAN DEFAULT FALSE,
  requires_comp_working_date BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,      -- system-generated (cutoff unpaid)
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT now()
);

-- gắn leave type vào request
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS requested_leave_type_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_leave_requests_type') THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT fk_leave_requests_type
      FOREIGN KEY (requested_leave_type_id) REFERENCES public.leave_types(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS public.calendar_overrides (
  id BIGSERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  type VARCHAR(30) NOT NULL,     -- HOLIDAY | WORKING_OVERRIDE
  name VARCHAR(200),
  year INT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT ck_cal_type CHECK (type IN ('HOLIDAY','WORKING_OVERRIDE'))
);

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS public.leave_type_policies (
  id BIGSERIAL PRIMARY KEY,
  leave_type_id BIGINT NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,

  max_per_request_days NUMERIC(5,2),
  min_duration_days NUMERIC(5,2),

  allow_negative BOOLEAN DEFAULT FALSE,
  max_negative_limit_days NUMERIC(5,2),

  annual_limit_days NUMERIC(7,2), -- unpaid 30 days/year

  auto_calculate_end_date BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT ck_policy_step CHECK (
    (max_per_request_days IS NULL OR (max_per_request_days * 2) = floor(max_per_request_days * 2)) AND
    (min_duration_days IS NULL OR (min_duration_days * 2) = floor(min_duration_days * 2)) AND
    (max_negative_limit_days IS NULL OR (max_negative_limit_days * 2) = floor(max_negative_limit_days * 2)) AND
    (annual_limit_days IS NULL OR (annual_limit_days * 2) = floor(annual_limit_days * 2))
  )
);

CREATE TABLE IF NOT EXISTS public.leave_type_conversions (
  id BIGSERIAL PRIMARY KEY,
  from_leave_type_id BIGINT NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  to_leave_type_id   BIGINT NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  priority INT NOT NULL,
  reason VARCHAR(40) NOT NULL, -- EXCEED_MAX_PER_REQUEST | EXCEED_BALANCE
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT ck_conv_priority CHECK (priority > 0),
  CONSTRAINT ck_conv_reason CHECK (reason IN ('EXCEED_MAX_PER_REQUEST','EXCEED_BALANCE'))
);

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS public.leave_request_items (
  id BIGSERIAL PRIMARY KEY,
  leave_request_id INT NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  leave_type_id BIGINT NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  amount_days NUMERIC(5,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT ck_item_step CHECK ((amount_days * 2) = floor(amount_days * 2)),
  CONSTRAINT ck_item_nonneg CHECK (amount_days >= 0)
);

CREATE TABLE IF NOT EXISTS public.leave_balance_transactions (
  id BIGSERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  leave_type_id BIGINT NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  period_year INT NOT NULL,
  period_month INT,
  direction VARCHAR(10) NOT NULL,  -- CREDIT | DEBIT
  amount_days NUMERIC(7,2) NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- ACCRUAL | APPROVAL | REFUND | ADJUSTMENT | PAYROLL_CUTOFF
  source_id BIGINT,
  note TEXT,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT ck_tx_dir CHECK (direction IN ('CREDIT','DEBIT')),
  CONSTRAINT ck_tx_step CHECK ((amount_days * 2) = floor(amount_days * 2)),
  CONSTRAINT ck_tx_nonneg CHECK (amount_days >= 0)
);

-- Compensatory leave requires a comp_working_date
CREATE TABLE IF NOT EXISTS public.leave_comp_links (
  id BIGSERIAL PRIMARY KEY,
  leave_request_id INT NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  comp_working_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- PDF evidence metadata
CREATE TABLE IF NOT EXISTS public.leave_request_attachments (
  id BIGSERIAL PRIMARY KEY,
  leave_request_id INT NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  original_filename VARCHAR(255),
  content_type VARCHAR(100) DEFAULT 'application/pdf',
  size_bytes BIGINT,
  storage_provider VARCHAR(30) NOT NULL, -- S3 | MINIO
  bucket VARCHAR(255),
  object_key TEXT NOT NULL,
  uploaded_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

COMMIT;
