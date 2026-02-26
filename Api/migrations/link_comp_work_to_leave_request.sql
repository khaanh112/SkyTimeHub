-- Migration: Link comp_work_requests directly to leave_requests
-- Removes the need for Leave_comp_links intermediate table
-- Date: 2026-02-26

BEGIN;

-- 1) Add leave_request_id FK to comp_work_requests
ALTER TABLE public.comp_work_requests
  ADD COLUMN IF NOT EXISTS leave_request_id INTEGER;

-- 2) Add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_comp_work_leave_request'
  ) THEN
    ALTER TABLE public.comp_work_requests
      ADD CONSTRAINT fk_comp_work_leave_request
      FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_comp_work_leave_request
  ON public.comp_work_requests(leave_request_id)
  WHERE leave_request_id IS NOT NULL;

-- 4) Drop leave_comp_links if it still exists (already deleted by user, safety net)
DROP TABLE IF EXISTS public.leave_comp_links;

COMMIT;
