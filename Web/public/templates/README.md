# User Import Template

## Excel Template Format

The Excel template file `users-import-template.xlsx` contains the following columns:

### Required Fields (*)
- **email*** - Valid email address (max 255 characters)
  - Example: user@example.com
- **username*** - Full name (max 100 characters)
  - Example: John Doe, Nguyen Van A
- **gender*** - Gender of the employee
  - Valid values: `male` or `female`

### Optional Fields
- **employeeId** - Unique employee identifier (max 20 characters)
  - Example: SG100, SG101, etc.
  - Auto-generated in format SG{number} if not provided
- **phoneNumber** - Phone number (max 20 characters)
  - Example: 0901234567
- **dateOfBirth** - Date of birth
  - Format: YYYY-MM-DD
  - Example: 1995-06-15
- **address** - Address (max 255 characters)
  - Example: 123 Main St, Hanoi
- **role** - User role in the system
  - Valid values: `admin`, `hr`, `employee`
  - Default: `employee` if not specified
- **departmentId** - Department ID (positive integer)
  - Must be a valid existing department ID
- **position** - Job position/title (max 100 characters)
  - Example: Software Engineer, HR Manager, Department Leader
- **joinDate** - Date when employee joined
  - Format: YYYY-MM-DD
  - Example: 2024-01-15
- **officialContractDate** - Official contract start date
  - Format: YYYY-MM-DD
  - Example: 2024-03-01
  - Can differ from joinDate (e.g., after probation period)
- **contractType** - Type of employment contract
  - Valid values: `intern`, `probation`, `official`

## Import Rules

1. **File Limits**:
   - Maximum file size: 10MB
   - Maximum rows: 1000
   - Accepted formats: .xlsx, .xls

2. **Data Validation**:
   - Email must be unique (not already in system)
   - Employee ID must be unique (not already in system)
   - Gender must be either "male" or "female" (case-insensitive)
   - All required fields must be filled

3. **Default Status**:
   - All imported users will have status set to `PENDING`
   - Users need to activate their accounts via activation link

## Excel Template Structure

```
| employeeId | email              | username    | phoneNumber  | gender | dateOfBirth | address             | role     | departmentId | position           | joinDate   | officialContractDate | contractType |
|------------|--------------------|-------------|--------------|--------|-------------|---------------------|----------|--------------|--------------------|-----------:|---------------------:|:-------------|
| EMP240001  | john@example.com   | John Doe    | 0901234567   | male   | 1995-06-15  | 123 Main St, Hanoi  | employee | 1            | Software Engineer  | 2024-01-15 | 2024-03-15           | official     |
| EMP240002  | jane@example.com   | Jane Smith  | 0912345678   | female | 1998-03-20  | 456 Le Loi, HCM     | hr       | 2            | HR Manager         | 2024-02-01 | 2024-02-01           | probation    |
```

## How to Use

1. Download the template file `users-import-template.xlsx`
2. Fill in your user data (keep the header row unchanged)
3. Save the file
4. Upload via the Import Users page
5. Review the preview for any validation errors
6. Click Import to add users to the system

## Notes

- The template header row must remain unchanged
- Empty rows will be skipped automatically
- If there are validation errors, fix them in the Excel file and re-upload
- After successful import, users will receive activation emails
