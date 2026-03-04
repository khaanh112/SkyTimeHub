-- Migration: Add missing FK indexes on leave_types and users
-- Created: 2026-03-04
-- Description: Add indexes on leave_types.category_id and users.department_id
--              to optimise JOIN queries that traverse these foreign keys.

-- Index on leave_types.category_id
CREATE INDEX IF NOT EXISTS idx_leave_types_category
  ON leave_types (category_id);

-- Index on users.department_id
CREATE INDEX IF NOT EXISTS idx_users_department
  ON users (department_id);

-- Verify
SELECT indexname, tablename
  FROM pg_indexes
 WHERE indexname IN ('idx_leave_types_category', 'idx_users_department');
