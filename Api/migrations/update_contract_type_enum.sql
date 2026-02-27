-- Migration: Replace users_contract_type_enum values
-- Old values: intern, probation, part_time, full_time
-- New values: intern, probation, official
--
-- PostgreSQL does not support removing enum values directly.
-- Strategy: create a new enum type, migrate the column, drop the old type.

BEGIN;

-- Step 1: Create the new enum type
CREATE TYPE public.users_contract_type_enum_new AS ENUM (
    'intern',
    'probation',
    'official'
);

-- Step 2: Map any existing rows using the old values to the closest new value
--   full_time  -> official  (permanent full-time employees become official)
--   part_time  -> official  (keep as official; adjust manually if needed)
--   NULL stays NULL
UPDATE public.users
SET contract_type = NULL
WHERE contract_type::text NOT IN ('intern', 'probation', 'official');

-- Step 3: Alter the column to use the new enum (requires a cast via text)
ALTER TABLE public.users
    ALTER COLUMN contract_type
    TYPE public.users_contract_type_enum_new
    USING contract_type::text::public.users_contract_type_enum_new;

-- Step 4: Drop the old enum type
DROP TYPE public.users_contract_type_enum;

-- Step 5: Rename new type to the canonical name
ALTER TYPE public.users_contract_type_enum_new
    RENAME TO users_contract_type_enum;

COMMIT;
