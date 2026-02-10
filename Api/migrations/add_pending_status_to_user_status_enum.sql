-- =====================================================
-- ADD PENDING STATUS TO USER_STATUS ENUM
-- SkyTimeHub Migration Script
-- Date: February 9, 2026
-- =====================================================

-- This migration adds 'pending' status to the user_status enum
-- to support the new activation flow where users are created
-- with pending status and must activate via email link.

-- BACKUP YOUR DATABASE BEFORE RUNNING!

BEGIN;

-- =====================================================
-- 1. ADD 'pending' TO user_status ENUM
-- =====================================================

-- Add 'pending' value to user_status enum if it doesn't exist
DO $$
BEGIN
    -- Check if 'pending' value already exists in user_status enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'pending' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'user_status'
        )
    ) THEN
        -- Add 'pending' to the enum
        -- Note: We add it at the beginning so the order is: pending, active, inactive
        ALTER TYPE user_status ADD VALUE 'pending' BEFORE 'active';
        
        RAISE NOTICE 'Added pending value to user_status enum';
    ELSE
        RAISE NOTICE 'pending value already exists in user_status enum';
    END IF;
END$$;

-- =====================================================
-- 2. VERIFY CHANGES
-- =====================================================

-- Check all values in user_status enum
SELECT enumlabel AS status_value, enumsortorder AS sort_order
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_status')
ORDER BY enumsortorder;

-- =====================================================
-- 3. UPDATE DEFAULT STATUS FOR NEW USERS (OPTIONAL)
-- =====================================================

-- If you want to change the default status for new users to 'pending'
-- Uncomment the following line:
-- ALTER TABLE users ALTER COLUMN status SET DEFAULT 'pending';

COMMIT;

-- =====================================================
-- NOTES
-- =====================================================
-- After running this migration:
-- - New users created via API will have status 'pending'
-- - They will receive activation email
-- - Clicking activation link changes status to 'active'
-- - HR can manually change status from 'active' to 'inactive' (deactivate)
-- - HR can change status from 'inactive' to 'active' (reactivate)
-- 
-- Status Flow:
-- CREATE → pending → ACTIVATE → active → DEACTIVATE → inactive → REACTIVATE → active

-- =====================================================
-- ROLLBACK SCRIPT (if needed, run separately)
-- =====================================================
/*
BEGIN;

-- Note: You cannot remove an enum value once added in PostgreSQL
-- The only way to remove an enum value is to:
-- 1. Create a new enum type without the value
-- 2. Update all columns using the old enum to use the new enum
-- 3. Drop the old enum type
-- This is a complex operation and should be done carefully

-- For now, if rollback is needed, you can:
-- 1. Update all users with 'pending' status to 'inactive'
UPDATE users SET status = 'inactive' WHERE status = 'pending';

-- 2. Set default back to 'inactive' (if changed)
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'inactive';

COMMIT;
*/
