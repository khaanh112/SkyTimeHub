-- =====================================================
-- SYNC DATABASE TO MATCH TYPEORM ENTITIES
-- SkyTimeHub Migration Script
-- Date: February 5, 2026
-- =====================================================

-- Run this script to update the database to match the entity definitions
-- BACKUP YOUR DATABASE BEFORE RUNNING!

BEGIN;

-- =====================================================
-- 1. UPDATE ENUMS
-- =====================================================

-- Check and update leave_status enum to match LeaveRequestStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'done' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'leave_status')) THEN
        ALTER TYPE leave_status ADD VALUE 'done';
    END IF;
END$$;

-- Create recipient_type enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipient_type') THEN
        CREATE TYPE recipient_type AS ENUM ('HR', 'CC', 'SYSTEM');
    END IF;
END$$;

-- =====================================================
-- 2. CREATE MISSING TABLES
-- =====================================================

-- Create user_approvers table
CREATE TABLE IF NOT EXISTS user_approvers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_approvers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_approvers_approver FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT uq_user_approver_active UNIQUE (user_id, active)
);

-- Create indexes for user_approvers
CREATE INDEX IF NOT EXISTS idx_user_approvers_user_active ON user_approvers(user_id, active);

-- Create leave_request_notification_recipients table
CREATE TABLE IF NOT EXISTS leave_request_notification_recipients (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type recipient_type DEFAULT 'CC',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_notify_request FOREIGN KEY (request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_notify_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT uq_leave_notify_request_user UNIQUE (request_id, user_id)
);

-- Create indexes for leave_request_notification_recipients
CREATE INDEX IF NOT EXISTS idx_leave_notify_request ON leave_request_notification_recipients(request_id);
CREATE INDEX IF NOT EXISTS idx_leave_notify_user_type ON leave_request_notification_recipients(user_id, type);

-- =====================================================
-- 3. UPDATE leave_requests TABLE
-- =====================================================

-- Make reason nullable (entity says nullable: true)
ALTER TABLE leave_requests ALTER COLUMN reason DROP NOT NULL;

-- Change approved_at to timestamptz
ALTER TABLE leave_requests ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at::TIMESTAMPTZ;

-- Change cancelled_at to timestamptz (if not already)
ALTER TABLE leave_requests ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at::TIMESTAMPTZ;

-- Change created_at to timestamptz
ALTER TABLE leave_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::TIMESTAMPTZ;

-- Change updated_at to timestamptz
ALTER TABLE leave_requests ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::TIMESTAMPTZ;

-- Make approver_id NOT NULL (entity says nullable: false)
-- First set any NULL values to a default approver (you may need to adjust this)
-- UPDATE leave_requests SET approver_id = 1 WHERE approver_id IS NULL;
-- ALTER TABLE leave_requests ALTER COLUMN approver_id SET NOT NULL;

-- Add indexes matching entity
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_status ON leave_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approver_status ON leave_requests(approver_id, status);

-- Make duration column nullable (entity doesn't have this field, so make nullable to avoid NOT NULL errors)
ALTER TABLE leave_requests ALTER COLUMN duration DROP NOT NULL;

-- =====================================================
-- 4. UPDATE users TABLE
-- =====================================================

-- Make username nullable (entity says nullable: true)
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- =====================================================
-- 5. UPDATE FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Drop old constraint on leave_requests.approver_id
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_approver_id_fkey;

-- Add new constraint with ON DELETE RESTRICT
ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_approver_id_fkey 
FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Drop old constraint on leave_requests.user_id
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_user_id_fkey;

-- Add new constraint with ON DELETE RESTRICT (entity says onDelete: 'RESTRICT')
ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- =====================================================
-- 6. OPTIONAL: Insert test data for user_approvers
-- =====================================================

-- This creates approver relationships so leave requests work
-- Adjust user IDs based on your data

-- Example: Make user 1 the approver for all users (except themselves)
-- INSERT INTO user_approvers (user_id, approver_id, active, created_at)
-- SELECT id, 1, true, NOW() 
-- FROM users 
-- WHERE id != 1 
-- ON CONFLICT (user_id, active) DO NOTHING;

-- =====================================================
-- 7. VERIFY CHANGES
-- =====================================================

-- Check tables exist
SELECT 'user_approvers' AS table_name, COUNT(*) AS row_count FROM user_approvers
UNION ALL
SELECT 'leave_request_notification_recipients', COUNT(*) FROM leave_request_notification_recipients;

-- Check leave_requests columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leave_requests'
ORDER BY ordinal_position;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (if needed, run separately)
-- =====================================================
/*
BEGIN;

DROP TABLE IF EXISTS leave_request_notification_recipients;
DROP TABLE IF EXISTS user_approvers;
DROP TYPE IF EXISTS recipient_type;

ROLLBACK;
*/
