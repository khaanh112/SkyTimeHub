-- Migration: Add missing columns to leave_requests table
-- Run this script manually against your PostgreSQL database

-- Add rejected_at column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leave_requests' AND column_name = 'rejected_at') THEN
        ALTER TABLE leave_requests ADD COLUMN rejected_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add cancelled_at column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leave_requests' AND column_name = 'cancelled_at') THEN
        ALTER TABLE leave_requests ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
END $$;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leave_requests' 
  AND column_name IN ('rejected_at', 'cancelled_at');
