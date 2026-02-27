import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { UserRole } from '@common/enums/roles.enum';
import { ImportExecuteResult, ImportUserRow } from '../users/dto/import-user.dto';
import { ImportPreviewResult } from '../users/dto/import-user.dto';
import { UsersService } from '../users/users.service';
import { UserStatus } from '@common/enums/user-status.enum';
import { UserGender } from '@common/enums/user-genders';
import { ContractType } from '@common/enums/contract-type.enum';
import { DepartmentEnum } from '@common/enums/departments.enum';
import { CreateUserDto } from '@modules/users/dto/create-user.dto';
import { Repository } from 'typeorm';
import { User } from '@entities/users.entity';
import { Department } from '@entities/departments.entity';
import { InjectRepository } from '@nestjs/typeorm/dist/common/typeorm.decorators';

@Injectable()
export class ExcelService {
  // Cache department name -> id mapping (loaded once per preview)
  private departmentMap: Map<string, number> = new Map();

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    private usersService: UsersService,
  ) {}

  /**
   * Load all departments from DB and cache the name->id mapping
   */
  private async loadDepartmentMap(): Promise<void> {
    const departments = await this.departmentRepository.find();
    this.departmentMap.clear();
    for (const dept of departments) {
      // Map by enum name (e.g. "HR_ADMIN" -> 1)
      this.departmentMap.set(dept.name.toUpperCase(), dept.id);
      // Also map by ID string (e.g. "1" -> 1) for backward compatibility
      this.departmentMap.set(String(dept.id), dept.id);
    }
  }

  /**
   * Resolve department from name or ID string. Returns { id, name } or null.
   */
  private resolveDepartment(value: string): { id: number; name: string } | null {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();

    // Try direct match by name
    if (this.departmentMap.has(normalized)) {
      const id = this.departmentMap.get(normalized)!;
      // Find the original name
      for (const [key, val] of this.departmentMap.entries()) {
        if (val === id && Object.values(DepartmentEnum).map(v => v.toUpperCase()).includes(key)) {
          return { id, name: key };
        }
      }
      return { id, name: normalized };
    }

    // Try as numeric ID
    const numId = Number(value.trim());
    if (!isNaN(numId) && Number.isInteger(numId) && numId > 0) {
      for (const [key, val] of this.departmentMap.entries()) {
        if (val === numId && Object.values(DepartmentEnum).map(v => v.toUpperCase()).includes(key)) {
          return { id: numId, name: key };
        }
      }
    }

    return null;
  }

  async previewImport(file: Express.Multer.File): Promise<ImportPreviewResult> {
    try {
      // Validate file exists
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds 10MB limit');
      }

      // Check file type by extension
      if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
        throw new BadRequestException('Only Excel files (.xlsx, .xls) are allowed');
      }

      // Check mime type
      const validMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (file.mimetype && !validMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Upload a valid Excel file');
      }

      // Validate buffer exists and has content
      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestException('Uploaded file is empty or corrupted');
      }

      // Parse Excel file with error handling
      let workbook;
      try {
        workbook = XLSX.read(file.buffer, {
          type: 'buffer',
          cellDates: true,
          cellNF: false,
          cellText: false,
        });
      } catch (parseError) {
        throw new BadRequestException(
          'Failed to parse Excel file. File may be corrupted or password-protected',
        );
      }

      // Validate workbook has sheets
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new BadRequestException('Excel file has no sheets');
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Validate worksheet exists
      if (!worksheet) {
        throw new BadRequestException('First sheet is empty or invalid');
      }

      // Parse sheet to JSON with error handling
      let data: any[];
      try {
        data = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: '',
          blankrows: false,
        });
      } catch (jsonError) {
        throw new BadRequestException('Failed to read sheet data. Check Excel format');
      }

      // Validate data exists
      if (!data || data.length === 0) {
        throw new BadRequestException('Excel file has no data rows (header row found but no data)');
      }

      // Validate maximum rows (prevent memory issues)
      const maxRows = 1000;
      if (data.length > maxRows) {
        throw new BadRequestException(
          `Too many rows. Maximum ${maxRows} rows allowed, found ${data.length}`,
        );
      }

      // Validate required columns exist
      const requiredColumns = ['email', 'username', 'gender'];
      const firstRow = data[0];
      const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
      if (missingColumns.length > 0) {
        throw new BadRequestException(
          `Missing required columns: ${missingColumns.join(', ')}. Download the template for correct format`,
        );
      }

      // Validate each row
      const rows: ImportUserRow[] = [];
      let validCount = 0;
      let invalidCount = 0;

      // Load department mapping from DB for name->id resolution
      await this.loadDepartmentMap();
      const validDepartmentNames = Object.values(DepartmentEnum);

      for (let i = 0; i < data.length; i++) {
        const rowData = data[i];
        const rowNumber = i + 2; // Excel row (header is row 1)
        const errors: string[] = [];

        try {
          // Skip completely empty rows
          const hasAnyData = Object.values(rowData).some(
            (val) => val !== null && val !== undefined && String(val).trim() !== '',
          );
          if (!hasAnyData) {
            continue; // Skip empty row
          }

          // Validate required fields
          const email =
            rowData.email !== null && rowData.email !== undefined
              ? String(rowData.email).trim()
              : '';
          if (!email) {
            errors.push('Email is required');
          } else if (email.length > 255) {
            errors.push('Email is too long (max 255 characters)');
          } else if (!this.isValidEmail(email)) {
            errors.push('Invalid email format');
          }

          const username =
            rowData.username !== null && rowData.username !== undefined
              ? String(rowData.username).trim()
              : '';
          if (!username) {
            errors.push('Username is required');
          } else if (username.length > 100) {
            errors.push('Username is too long (max 100 characters)');
          }

          // Validate employeeId (OPTIONAL - auto-generated if not provided)
          const employeeId =
            rowData.employeeId !== null && rowData.employeeId !== undefined
              ? String(rowData.employeeId).trim()
              : '';
          if (employeeId && employeeId.length > 20) {
            errors.push('Employee ID must be max 20 characters');
          }

          // Validate gender (REQUIRED)
          const genderRaw =
            rowData.gender !== null && rowData.gender !== undefined
              ? String(rowData.gender).trim()
              : '';
          const gender = genderRaw ? this.normalizeGender(genderRaw) : '';
          if (!genderRaw) {
            errors.push('Gender is required');
          } else if (!gender) {
            errors.push(`Invalid gender "${genderRaw}". Must be one of: ${Object.values(UserGender).join(', ')} (or: M, F, Nam, Nữ)`);
          }

          // Validate optional fields with null safety
          let normalizedRole: string | undefined;
          if (rowData.role !== null && rowData.role !== undefined && String(rowData.role).trim()) {
            const roleStr = String(rowData.role).trim();
            normalizedRole = this.normalizeRole(roleStr);
            if (!normalizedRole) {
              errors.push(`Invalid role "${roleStr}". Must be one of: ${Object.values(UserRole).join(', ')}`);
            }
          }

          if (rowData.position !== null && rowData.position !== undefined) {
            const posStr = String(rowData.position).trim();
            if (posStr && posStr.length > 100) {
              errors.push('Position is too long (max 100 characters)');
            }
          }

          // Resolve department: support both "department" (name) and "departmentId" columns
          let resolvedDepartment: { id: number; name: string } | null = null;
          const deptNameRaw = rowData.department !== null && rowData.department !== undefined
            ? String(rowData.department).trim()
            : '';
          const deptIdRaw = rowData.departmentId !== null && rowData.departmentId !== undefined
            ? String(rowData.departmentId).trim()
            : '';

          if (deptNameRaw) {
            // Resolve by department name
            resolvedDepartment = this.resolveDepartment(deptNameRaw);
            if (!resolvedDepartment) {
              errors.push(
                `Invalid department "${deptNameRaw}". Must be one of: ${validDepartmentNames.join(', ')}`,
              );
            }
          } else if (deptIdRaw) {
            // Resolve by department ID
            resolvedDepartment = this.resolveDepartment(deptIdRaw);
            if (!resolvedDepartment) {
              errors.push(
                `Department ID "${deptIdRaw}" not found. Use department name instead: ${validDepartmentNames.join(', ')}`,
              );
            }
          }

          if (
            rowData.joinDate !== null &&
            rowData.joinDate !== undefined &&
            String(rowData.joinDate).trim()
          ) {
            const dateStr = String(rowData.joinDate).trim();
            const dateObj = new Date(dateStr);
            if (isNaN(dateObj.getTime())) {
              errors.push('Invalid join date format. Use YYYY-MM-DD');
            }
          }

          if (
            rowData.officialContractDate !== null &&
            rowData.officialContractDate !== undefined &&
            String(rowData.officialContractDate).trim()
          ) {
            const dateStr = String(rowData.officialContractDate).trim();
            const dateObj = new Date(dateStr);
            if (isNaN(dateObj.getTime())) {
              errors.push('Invalid official contract date format. Use YYYY-MM-DD');
            }
          }

          // Validate phoneNumber (optional)
          if (
            rowData.phoneNumber !== null &&
            rowData.phoneNumber !== undefined &&
            String(rowData.phoneNumber).trim()
          ) {
            const phone = String(rowData.phoneNumber).trim();
            if (phone.length > 20) {
              errors.push('Phone number is too long (max 20 characters)');
            }
          }

          // Validate dateOfBirth (optional)
          if (
            rowData.dateOfBirth !== null &&
            rowData.dateOfBirth !== undefined &&
            String(rowData.dateOfBirth).trim()
          ) {
            const dateStr = String(rowData.dateOfBirth).trim();
            const dateObj = new Date(dateStr);
            if (isNaN(dateObj.getTime())) {
              errors.push('Invalid date of birth format. Use YYYY-MM-DD');
            }
          }

          // Validate address (optional)
          if (
            rowData.address !== null &&
            rowData.address !== undefined &&
            String(rowData.address).trim()
          ) {
            const addr = String(rowData.address).trim();
            if (addr.length > 255) {
              errors.push('Address is too long (max 255 characters)');
            }
          }

          // Validate contractType (optional) - with normalization
          let normalizedContractType: string | undefined;
          if (
            rowData.contractType !== null &&
            rowData.contractType !== undefined &&
            String(rowData.contractType).trim()
          ) {
            const ctStr = String(rowData.contractType).trim();
            normalizedContractType = this.normalizeContractType(ctStr);
            if (!normalizedContractType) {
              errors.push(`Invalid contract type "${ctStr}". Must be one of: ${Object.values(ContractType).join(', ')}`);
            }
          }

          // Check for duplicate email in database (only if email is valid)
          if (email && this.isValidEmail(email)) {
            try {
              const existingUser = await this.usersService.getUserByEmail(email);
              if (existingUser) {
                errors.push('Email already exists in system');
              }
            } catch (dbError) {
              // Continue validation even if DB check fails
              errors.push('Could not verify email uniqueness');
            }
          }

          // Check for duplicate employeeId in database (only if employee ID is valid)
          if (employeeId && this.isValidEmployeeId(employeeId)) {
            try {
              const existingEmployee = await this.usersService.findByEmployeeId(employeeId);
              if (existingEmployee) {
                errors.push('Employee ID already exists in system');
              }
            } catch (dbError) {
              errors.push('Could not verify employee ID uniqueness');
            }
          }

          const row: ImportUserRow = {
            rowNumber,
            employeeId: employeeId || undefined,
            email: email,
            username: username,
            gender: gender || undefined,
            role: normalizedRole || undefined,
            departmentId: resolvedDepartment ? resolvedDepartment.id : undefined,
            departmentName: resolvedDepartment ? resolvedDepartment.name : undefined,
            position:
              rowData.position !== null &&
              rowData.position !== undefined &&
              String(rowData.position).trim()
                ? String(rowData.position).trim()
                : undefined,
            joinDate:
              rowData.joinDate !== null &&
              rowData.joinDate !== undefined &&
              String(rowData.joinDate).trim()
                ? String(rowData.joinDate).trim()
                : undefined,
            officialContractDate:
              rowData.officialContractDate !== null &&
              rowData.officialContractDate !== undefined &&
              String(rowData.officialContractDate).trim()
                ? String(rowData.officialContractDate).trim()
                : undefined,
            phoneNumber:
              rowData.phoneNumber !== null &&
              rowData.phoneNumber !== undefined &&
              String(rowData.phoneNumber).trim()
                ? String(rowData.phoneNumber).trim()
                : undefined,
            dateOfBirth:
              rowData.dateOfBirth !== null &&
              rowData.dateOfBirth !== undefined &&
              String(rowData.dateOfBirth).trim()
                ? String(rowData.dateOfBirth).trim()
                : undefined,
            address:
              rowData.address !== null &&
              rowData.address !== undefined &&
              String(rowData.address).trim()
                ? String(rowData.address).trim()
                : undefined,
            contractType: normalizedContractType || undefined,
            errors,
          };

          rows.push(row);

          if (errors.length === 0) {
            validCount++;
          } else {
            invalidCount++;
          }
        } catch (rowError) {
          // Handle unexpected errors in row processing
          const errorRow: ImportUserRow = {
            rowNumber,
            employeeId: undefined,
            email: '',
            username: '',
            gender: undefined,
            role: undefined,
            departmentId: undefined,
            departmentName: undefined,
            position: undefined,
            joinDate: undefined,
            officialContractDate: undefined,
            phoneNumber: undefined,
            dateOfBirth: undefined,
            address: undefined,
            contractType: undefined,
            errors: [`Failed to process row: ${rowError.message || 'Unknown error'}`],
          };
          rows.push(errorRow);
          invalidCount++;
        }
      }

      // Final validation
      if (rows.length === 0) {
        throw new BadRequestException('No valid rows found in Excel file');
      }

      return {
        totalRows: rows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        rows,
      };
    } catch (error) {
      // Handle any unexpected errors
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message || 'Unknown error'}. Please ensure file is not corrupted and follows the template format.`,
      );
    }
  }

  /**
   * Execute import after preview confirmation
   */
  async executeImport(rows: ImportUserRow[]): Promise<ImportExecuteResult> {
    const result: ImportExecuteResult = {
      success: true,
      totalProcessed: 0,
      successCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Validate input
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        throw new BadRequestException('No rows provided for import');
      }

      // Only import valid rows
      const validRows = rows.filter(
        (row) => row && Array.isArray(row.errors) && row.errors.length === 0,
      );

      if (validRows.length === 0) {
        throw new BadRequestException('No valid rows to import');
      }

      result.totalProcessed = validRows.length;

      for (const row of validRows) {
        try {
          // Validate row data - email, username, and gender are required
          if (!row.email || !row.username || !row.gender) {
            throw new Error('Missing required fields: email, username, or gender');
          }

          const userData: CreateUserDto = {
            employeeId: row.employeeId || undefined,
            email: row.email,
            username: row.username,
            gender: row.gender as UserGender,
            role: row.role as UserRole,
            departmentId: row.departmentId,
            position: row.position,
            joinDate: row.joinDate ? new Date(row.joinDate) : undefined,
            officialContractDate: row.officialContractDate
              ? new Date(row.officialContractDate)
              : undefined,
            phoneNumber: row.phoneNumber || undefined,
            dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
            address: row.address || undefined,
            contractType: row.contractType as ContractType || undefined,
            status: UserStatus.PENDING, // All imported users auto-set to pending
          };

          await this.usersService.createUser(userData);

          result.successCount++;
        } catch (error) {
          result.failedCount++;
          const errorMessage = error.message || 'Failed to create user';
          result.errors.push({
            rowNumber: row.rowNumber || 0,
            email: row.email || 'unknown',
            error: errorMessage,
          });
        }
      }

      result.success = result.failedCount === 0;
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Import failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate employee ID format
   */
  private isValidEmployeeId(employeeId: string): boolean {
    return employeeId && employeeId.length > 0 && employeeId.length <= 20;
  }

  /**
   * Normalize contract type input to match enum values.
   * Supports: "Official" -> "official", "Intern" -> "intern", "Probation" -> "probation", etc.
   */
  private normalizeContractType(value: string): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
    const validTypes = Object.values(ContractType);
    if (validTypes.includes(normalized as ContractType)) {
      return normalized;
    }
    // Try without underscores for fuzzy matching
    const noUnderscore = normalized.replace(/_/g, '');
    for (const ct of validTypes) {
      if (ct.replace(/_/g, '') === noUnderscore) {
        return ct;
      }
    }
    return null;
  }

  /**
   * Normalize role input to match enum values.
   * Supports: "HR" -> "hr", "Admin" -> "admin", "Employee" -> "employee"
   */
  private normalizeRole(value: string): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    const validRoles = Object.values(UserRole);
    if (validRoles.includes(normalized as UserRole)) {
      return normalized;
    }
    return null;
  }

  /**
   * Normalize gender input.
   * Supports: "Male" -> "male", "M" -> "male", "F" -> "female", "Nam" -> "male", "Nữ" -> "female"
   */
  private normalizeGender(value: string): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    const validGenders = Object.values(UserGender);
    if (validGenders.includes(normalized as UserGender)) {
      return normalized;
    }
    // Common aliases
    const genderAliases: Record<string, UserGender> = {
      m: UserGender.MALE,
      f: UserGender.FEMALE,
      nam: UserGender.MALE,
      'nữ': UserGender.FEMALE,
      nu: UserGender.FEMALE,
    };
    return genderAliases[normalized] || null;
  }
}
