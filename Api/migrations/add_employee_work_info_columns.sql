-- Migration: Add employee work information columns to users table
-- Adds: position, official_contract_date, department_id (if not exists)
-- Run this script manually against your PostgreSQL database

-- Add position column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'position') THEN
        ALTER TABLE users ADD COLUMN position VARCHAR(100) NULL;
        COMMENT ON COLUMN users.position IS 'Job position/title';
    END IF;
END $$;

-- Add official_contract_date column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'official_contract_date') THEN
        ALTER TABLE users ADD COLUMN official_contract_date DATE NULL;
        COMMENT ON COLUMN users.official_contract_date IS 'Official contract start date';
    END IF;
END $$;

-- Add department_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'department_id') THEN
        ALTER TABLE users ADD COLUMN department_id INTEGER NULL;
        COMMENT ON COLUMN users.department_id IS 'Department foreign key';
    END IF;
END $$;

-- Add foreign key constraint for department_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_users_department_id' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT fk_users_department_id 
        FOREIGN KEY (department_id) 
        REFERENCES departments(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Verify columns were added
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('position', 'official_contract_date', 'department_id')
ORDER BY ordinal_position;

COMMENT ON COLUMN users.position IS 'Job position/title of the employee';
COMMENT ON COLUMN users.official_contract_date IS 'Date when official employment contract starts';
COMMENT ON COLUMN users.department_id IS 'Reference to department the employee belongs to';
