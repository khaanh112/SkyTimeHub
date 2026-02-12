-- Migration: Add gender column to users table
-- Run this script manually against your PostgreSQL database

-- Create gender enum type if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_gender_enum') THEN
        CREATE TYPE user_gender_enum AS ENUM ('male', 'female');
    END IF;
END $$;

-- Add gender column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'gender') THEN
        ALTER TABLE users ADD COLUMN gender user_gender_enum NOT NULL DEFAULT 'male';
    END IF;
END $$;

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'gender';
