import { ConflictException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { User } from "./users.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ImportUserRow, ImportPreviewResult, ImportExecuteResult } from "./dto/import-user.dto";
import { UserRole } from "../common/enums/roles.enum";
import { UserStatus } from "../common/enums/user-status.enum";

import * as crypto from 'crypto';
import * as XLSX from 'xlsx';

@Injectable()
export class UsersService {
  
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Generate unique employee ID
   * Format: EMP + Year (2 digits) + Sequential number (4 digits)
   * Example: EMP240001
   */
  async generateEmployeeId(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `EMP${year}`;
    
    // Find the latest employee ID with current year prefix
    const latestUser = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.employee_id LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('user.employee_id', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (latestUser && latestUser.employeeId) {
      const lastNumber = parseInt(latestUser.employeeId.slice(-4));
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Generate activation token for new users
   */
  generateActivationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async getUsers(): Promise<User[]> {
    return await this.usersRepository.find({
      relations: ['department'],
    });
  }

  async getUser(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      relations: ['department'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ 
      where: { email },
      relations: ['department'],
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ 
      where: { email },
      relations: ['department'],
    });
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    return await this.usersRepository.findOne({ 
      where: { employeeId },
      relations: ['department'],
    });
  }

  async createUser(user: CreateUserDto): Promise<User> {
    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({ where: { email: user.email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if employeeId already exists (if provided)
    if (user.employeeId) {
      const existingEmployee = await this.usersRepository.findOne({ where: { employeeId: user.employeeId } });
      if (existingEmployee) {
        throw new ConflictException('User with this employee ID already exists');
      }
    }

    // Generate employee ID if not provided
    if (!user.employeeId) {
      user.employeeId = await this.generateEmployeeId();
    }

    // Generate activation token for inactive users
    const activationToken = this.generateActivationToken();

    const newUser = this.usersRepository.create({
      ...user,
      activationToken,
    });
    
    return await this.usersRepository.save(newUser);
  } 

  async updateUser(id: number, user: UpdateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check if email is being updated and already exists
    if (user.email && user.email !== existingUser.email) {
      const emailExists = await this.usersRepository.findOne({ where: { email: user.email } });
      if (emailExists) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Check if employeeId is being updated and already exists
    if (user.employeeId && user.employeeId !== existingUser.employeeId) {
      const employeeIdExists = await this.usersRepository.findOne({ where: { employeeId: user.employeeId } });
      if (employeeIdExists) {
        throw new ConflictException('User with this employee ID already exists');
      }
    }

    const updatedUser = this.usersRepository.merge(existingUser, user);
    return await this.usersRepository.save(updatedUser);
  }

  async updateRefreshToken(userId: number, refreshTokenHash: string | null): Promise<void> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    await this.usersRepository.update({ id: userId }, { refreshTokenHash });
  }

  async deleteUser(id: number): Promise<void> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.delete(id);
  }

  /**
   * Activate user account with token
   */
  async activateAccount(token: string): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { activationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid activation token');
    }

    // Update user status and clear activation token
    user.status = UserStatus.ACTIVE;
    user.activatedAt = new Date();
    user.activationToken = null;

    return await this.usersRepository.save(user);
  }

  /**
   * Resend activation email (regenerate token)
   */
  async resendActivation(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('User account is already active');
    }

    // Generate new activation token
    user.activationToken = this.generateActivationToken();

    return await this.usersRepository.save(user);
  }

  /**
   * Get activation token for user (for HR to send activation link)
   */
  async getActivationToken(userId: number): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('User account is already active');
    }

    if (!user.activationToken) {
      throw new BadRequestException('No activation token found for this user');
    }

    return user.activationToken;
  }

  // =====================================================
  // IMPORT USERS FROM EXCEL
  // =====================================================

  /**
   * Parse Excel file and validate data
   */
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
        throw new BadRequestException('Failed to parse Excel file. File may be corrupted or password-protected');
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
        throw new BadRequestException(`Too many rows. Maximum ${maxRows} rows allowed, found ${data.length}`);
      }

      // Validate required columns exist
      const requiredColumns = ['email', 'username'];
      const firstRow = data[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      if (missingColumns.length > 0) {
        throw new BadRequestException(`Missing required columns: ${missingColumns.join(', ')}. Download the template for correct format`);
      }

      // Validate each row
      const rows: ImportUserRow[] = [];
      let validCount = 0;
      let invalidCount = 0;

      for (let i = 0; i < data.length; i++) {
        const rowData = data[i];
        const rowNumber = i + 2; // Excel row (header is row 1)
        const errors: string[] = [];

        try {
          // Skip completely empty rows
          const hasAnyData = Object.values(rowData).some(val => 
            val !== null && val !== undefined && String(val).trim() !== ''
          );
          if (!hasAnyData) {
            continue; // Skip empty row
          }

          // Validate required fields
          const email = rowData.email !== null && rowData.email !== undefined ? String(rowData.email).trim() : '';
          if (!email) {
            errors.push('Email is required');
          } else if (email.length > 255) {
            errors.push('Email is too long (max 255 characters)');
          } else if (!this.isValidEmail(email)) {
            errors.push('Invalid email format');
          }

          const username = rowData.username !== null && rowData.username !== undefined ? String(rowData.username).trim() : '';
          if (!username) {
            errors.push('Username is required');
          } else if (username.length > 100) {
            errors.push('Username is too long (max 100 characters)');
          }

          // Validate optional fields with null safety
          if (rowData.role !== null && rowData.role !== undefined && String(rowData.role).trim()) {
            const roleStr = String(rowData.role).trim();
            const validRoles = Object.values(UserRole);
            if (!validRoles.includes(roleStr as UserRole)) {
              errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
            }
          }

          if (rowData.phone !== null && rowData.phone !== undefined && String(rowData.phone).trim()) {
            const phoneStr = String(rowData.phone).trim();
            if (phoneStr.length > 20) {
              errors.push('Phone number is too long (max 20 characters)');
            } else if (!this.isValidPhone(phoneStr)) {
              errors.push('Invalid phone format. Use digits, spaces, +, -, (, )');
            }
          }

          if (rowData.employeeId !== null && rowData.employeeId !== undefined) {
            const empIdStr = String(rowData.employeeId).trim();
            if (empIdStr && empIdStr.length > 20) {
              errors.push('Employee ID must be max 20 characters');
            }
          }

          if (rowData.position !== null && rowData.position !== undefined) {
            const posStr = String(rowData.position).trim();
            if (posStr && posStr.length > 100) {
              errors.push('Position is too long (max 100 characters)');
            }
          }

          if (rowData.departmentId !== null && rowData.departmentId !== undefined && String(rowData.departmentId).trim()) {
            const deptId = Number(rowData.departmentId);
            if (isNaN(deptId) || deptId <= 0 || !Number.isInteger(deptId)) {
              errors.push('Department ID must be a positive integer');
            }
          }

          if (rowData.joinDate !== null && rowData.joinDate !== undefined && String(rowData.joinDate).trim()) {
            const dateStr = String(rowData.joinDate).trim();
            const dateObj = new Date(dateStr);
            if (isNaN(dateObj.getTime())) {
              errors.push('Invalid join date format. Use YYYY-MM-DD');
            }
          }

          // Check for duplicate email in database (only if email is valid)
          if (email && this.isValidEmail(email)) {
            try {
              const existingUser = await this.findByEmail(email);
              if (existingUser) {
                errors.push('Email already exists in system');
              }
            } catch (dbError) {
              // Continue validation even if DB check fails
              errors.push('Could not verify email uniqueness');
            }
          }

          // Check for duplicate employeeId in database
          if (rowData.employeeId !== null && rowData.employeeId !== undefined) {
            const empIdStr = String(rowData.employeeId).trim();
            if (empIdStr) {
              try {
                const existingEmployee = await this.findByEmployeeId(empIdStr);
                if (existingEmployee) {
                  errors.push('Employee ID already exists in system');
                }
              } catch (dbError) {
                errors.push('Could not verify employee ID uniqueness');
              }
            }
          }

          const row: ImportUserRow = {
            rowNumber,
            employeeId: (rowData.employeeId !== null && rowData.employeeId !== undefined && String(rowData.employeeId).trim()) 
              ? String(rowData.employeeId).trim() : undefined,
            email: email,
            username: username,
            role: (rowData.role !== null && rowData.role !== undefined && String(rowData.role).trim()) 
              ? String(rowData.role).trim() : undefined,
            departmentId: (rowData.departmentId !== null && rowData.departmentId !== undefined && String(rowData.departmentId).trim())
              ? Number(rowData.departmentId) : undefined,
            position: (rowData.position !== null && rowData.position !== undefined && String(rowData.position).trim())
              ? String(rowData.position).trim() : undefined,
            phone: (rowData.phone !== null && rowData.phone !== undefined && String(rowData.phone).trim())
              ? String(rowData.phone).trim() : undefined,
            joinDate: (rowData.joinDate !== null && rowData.joinDate !== undefined && String(rowData.joinDate).trim())
              ? String(rowData.joinDate).trim() : undefined,
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
            role: undefined,
            departmentId: undefined,
            position: undefined,
            phone: undefined,
            joinDate: undefined,
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
        `Failed to process Excel file: ${error.message || 'Unknown error'}. Please ensure file is not corrupted and follows the template format.`
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
      const validRows = rows.filter(row => 
        row && Array.isArray(row.errors) && row.errors.length === 0
      );

      if (validRows.length === 0) {
        throw new BadRequestException('No valid rows to import');
      }

      result.totalProcessed = validRows.length;

      for (const row of validRows) {
        try {
          // Validate row data
          if (!row.email || !row.username) {
            throw new Error('Missing required fields');
          }

          // Generate employee ID if not provided
          let employeeId;
          try {
            employeeId = row.employeeId || await this.generateEmployeeId();
          } catch (genError) {
            throw new Error(`Failed to generate employee ID: ${genError.message}`);
          }
          
          // Generate activation token
          const activationToken = this.generateActivationToken();

          const userData: CreateUserDto = {
            employeeId,
            email: row.email,
            username: row.username,
            role: row.role as UserRole,
            departmentId: row.departmentId,
            position: row.position,
            phone: row.phone,
            joinDate: row.joinDate ? new Date(row.joinDate) : undefined,
            status: UserStatus.INACTIVE, // New users start inactive
          };

          const user = this.usersRepository.create({
            ...userData,
            activationToken,
          });

          await this.usersRepository.save(user);
          
          
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
      throw new BadRequestException(
        `Import failed: ${error.message || 'Unknown error'}`
      );
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
   * Validate phone format
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[0-9+\-() ]+$/;
    return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
  }
}
