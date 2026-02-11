-- Migration: Add work_solution column to leave_requests table
-- Created: 2026-02-11
-- Description: Add optional work solution/handover column for leave requests

-- Add work_solution column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leave_requests' AND column_name = 'work_solution') THEN
        ALTER TABLE leave_requests ADD COLUMN work_solution TEXT NULL;
        RAISE NOTICE 'Column work_solution added successfully';
    ELSE
        RAISE NOTICE 'Column work_solution already exists';
    END IF;
END $$;

-- Verify column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'leave_requests' 
  AND column_name = 'work_solution';
