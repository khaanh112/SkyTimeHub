-- Migration: Add parental leave fields to leave_requests table
-- number_of_children: for calculating maternity entitlement (twins/multiples)
-- childbirth_method: natural or c_section (affects male paternity duration)

BEGIN;

-- Create the enum type for childbirth method
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'childbirth_method_enum') THEN
    CREATE TYPE childbirth_method_enum AS ENUM ('natural', 'c_section');
  END IF;
END$$;

-- Add columns to leave_requests
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS number_of_children INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS childbirth_method childbirth_method_enum DEFAULT NULL;

COMMIT;
