# Quick Guide: Adding New Database Columns

## Problem
When you add a new column to an entity but forget to add it to the database, you get:
```
QueryFailedError: column Table.columnName does not exist
```

## Solution Steps

### 1. Create Migration File
Create a new `.sql` file in `migrations/` folder:

```sql
-- Migration: Add your_column to your_table
-- Created: YYYY-MM-DD

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'your_table' AND column_name = 'your_column') THEN
        ALTER TABLE your_table ADD COLUMN your_column TYPE_HERE NULL;
        RAISE NOTICE 'Column your_column added successfully';
    ELSE
        RAISE NOTICE 'Column your_column already exists';
    END IF;
END $$;

-- Verify column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'your_table' 
  AND column_name = 'your_column';
```

### 2. Run Migration via Docker

```powershell
# Copy migration file to container
docker cp migrations\your_migration.sql sky_postgres:/tmp/migration.sql

# Execute migration
docker exec -i sky_postgres psql -U sky -d sky_hr -f /tmp/migration.sql

# Cleanup
docker exec -i sky_postgres rm /tmp/migration.sql
```

### 3. Update Entity (if not done already)

```typescript
@Column({ name: 'your_column', type: 'text', nullable: true })
yourColumn?: string;
```

**Important:** Always specify `name:` in `@Column()` decorator to explicitly map camelCase property to snake_case database column.

## Common Column Types

| TypeScript Type | PostgreSQL Type | TypeORM Type |
|----------------|-----------------|--------------|
| string         | TEXT            | 'text'       |
| string         | VARCHAR(255)    | 'varchar'    |
| number         | INTEGER         | 'int'        |
| number         | BIGINT          | 'bigint'     |
| boolean        | BOOLEAN         | 'boolean'    |
| Date           | TIMESTAMPTZ     | 'timestamptz'|
| enum           | ENUM            | 'enum'       |

## Example: work_solution Column

```sql
ALTER TABLE leave_requests ADD COLUMN work_solution TEXT NULL;
```

```typescript
@Column({ name: 'work_solution', type: 'text', nullable: true })
workSolution?: string;
```

## Naming Convention
- Database: snake_case (`work_solution`)
- TypeScript: camelCase (`workSolution`)
- Always use `name:` in `@Column()` decorator for clarity
