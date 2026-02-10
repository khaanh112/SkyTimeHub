/**
 * Represents a single row from the user import file
 */
export interface ImportUserRow {
  /** Row number in the Excel/CSV file */
  rowNumber: number;
  /** Employee ID */
  employeeId?: string;
  /** User email address */
  email: string;
  /** Username */
  username: string;
  /** User role */
  role?: string;
  /** Department ID */
  departmentId?: number;
  /** Job position */
  position?: string;
  /** Join date */
  joinDate?: string;
  /** Validation errors for this row */
  errors: string[];
}

/**
 * Result of previewing an import file before execution
 */
export interface ImportPreviewResult {
  /** Total number of rows in the file */
  totalRows: number;
  /** Number of valid rows */
  validRows: number;
  /** Number of invalid rows */
  invalidRows: number;
  /** All rows with validation status */
  rows: ImportUserRow[];
}

/**
 * Result of executing a user import
 */
export interface ImportExecuteResult {
  /** Whether the overall import was successful */
  success: boolean;
  /** Total number of rows processed */
  totalProcessed: number;
  /** Number of successfully imported users */
  successCount: number;
  /** Number of failed imports */
  failedCount: number;
  /** Detailed errors for failed imports */
  errors: Array<{
    /** Row number that failed */
    rowNumber: number;
    /** Email of the user that failed */
    email: string;
    /** Error message */
    error: string;
  }>;
}
