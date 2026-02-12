# Gender Column Migration

## Overview
This migration adds a `gender` column to the `users` table to store employee gender information (male/female).

## Files
- `add_gender_column.sql` - SQL migration script
- `run-gender-migration.ps1` - PowerShell script to execute the migration using Docker

## Migration Details

### Changes Made
1. Creates `user_gender_enum` type with values: `'male'`, `'female'`
2. Adds `gender` column to `users` table:
   - Type: `user_gender_enum`
   - NOT NULL constraint
   - Default value: `'male'`

### Related Code Changes
1. **Backend**:
   - `UserGender` enum already exists in `@common/enums/user-genders.ts`
   - `users.entity.ts` - Added gender property
   - `create-user.dto.ts` - Added required gender field
   - `update-user.dto.ts` - Added optional gender field
   - `import-user.dto.ts` - Added gender to import interface
   - `excel.service.ts` - Added gender validation for imports

2. **Frontend**:
   - `UsersPage.jsx` - Added gender field to create/edit forms
   - `ImportUsersPage.jsx` - Added gender column to preview table
   - Excel template updated with gender column

## How to Run

### Using Docker (Recommended)
```powershell
cd Api
.\migrations\run-gender-migration.ps1
```

### Manual Execution
If you prefer to run manually:
```powershell
docker cp migrations/add_gender_column.sql sky_postgres:/tmp/migration.sql
docker exec sky_postgres psql -U sky -d sky_hr -f /tmp/migration.sql
```

## Rollback
If you need to rollback this migration:

```sql
-- Remove gender column
ALTER TABLE users DROP COLUMN IF EXISTS gender;

-- Drop enum type
DROP TYPE IF EXISTS user_gender_enum;
```

## Verification
After running the migration, verify the column was added:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'gender';
```

Expected output:
```
 column_name |   data_type    | is_nullable | column_default 
-------------+----------------+-------------+----------------
 gender      | user_gender_enum| NO          | 'male'::user_gender_enum
```

## Important Notes
- All existing users will have gender set to 'male' by default
- You may want to update existing user records to set the correct gender
- The gender field is now REQUIRED for all new users (create and import)
- Valid values: 'male' or 'female' (case-sensitive in database)
