export interface ImportUserRow {
    rowNumber: number;
    employeeId?: string;
    email: string;
    username: string;
    role?: string;
    departmentId?: number;
    position?: string;
    phone?: string;
    joinDate?: string;
    errors: string[];
}
export interface ImportPreviewResult {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    rows: ImportUserRow[];
}
export interface ImportExecuteResult {
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failedCount: number;
    errors: Array<{
        rowNumber: number;
        email: string;
        error: string;
    }>;
}
