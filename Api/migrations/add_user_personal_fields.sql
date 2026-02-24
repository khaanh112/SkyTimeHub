-- Migration: Add phone_number, date_of_birth, address, contract_type columns to users table
-- Date: 2025-01-01

-- Create contract_type enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_contract_type_enum') THEN
        CREATE TYPE users_contract_type_enum AS ENUM ('intern', 'probation', 'part_time', 'full_time');
    END IF;
END
$$;

-- Add new columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL,
    ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS contract_type users_contract_type_enum NULL;
