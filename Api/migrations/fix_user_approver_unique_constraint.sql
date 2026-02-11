-- Fix user_approver unique constraint
-- The old constraint prevented multiple inactive records per user
-- The new partial index only enforces uniqueness when active=true

-- Drop the old constraint if it exists
ALTER TABLE user_approvers DROP CONSTRAINT IF EXISTS "uq_user_approver_active";

-- Create a partial unique index that only applies when active=true
-- This allows multiple inactive records but ensures only one active approver per user
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_approver_active" 
ON user_approvers (user_id) 
WHERE active = true;
