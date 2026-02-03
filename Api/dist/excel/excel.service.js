"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const XLSX = require("xlsx");
const users_entity_1 = require("../users/users.entity");
const roles_enum_1 = require("../common/enums/roles.enum");
const user_status_enum_1 = require("../common/enums/user-status.enum");
const invalid_format_exception_1 = require("./invalid-format.exception");
let ExcelService = class ExcelService {
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async previewUserImport(file) {
        try {
            if (!file) {
                throw new common_1.BadRequestException('Please select a file to upload');
            }
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                throw new invalid_format_exception_1.InvalidFormatException('File size exceeds 10MB. Please upload a smaller file');
            }
            if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
                throw new invalid_format_exception_1.InvalidFormatException('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
            }
            const validMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
            ];
            if (file.mimetype && !validMimeTypes.includes(file.mimetype)) {
                throw new invalid_format_exception_1.InvalidFormatException('Invalid file format. Please upload a valid Excel file');
            }
            if (!file.buffer || file.buffer.length === 0) {
                throw new invalid_format_exception_1.InvalidFormatException('File is empty or corrupted. Please upload a valid file');
            }
            let workbook;
            try {
                workbook = XLSX.read(file.buffer, {
                    type: 'buffer',
                    cellDates: true,
                    cellNF: false,
                    cellText: false,
                });
            }
            catch (parseError) {
                throw new invalid_format_exception_1.InvalidFormatException('Cannot read Excel file. File may be corrupted or password-protected');
            }
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new invalid_format_exception_1.InvalidFormatException('Excel file contains no sheets. Please check your file');
            }
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new invalid_format_exception_1.InvalidFormatException('First sheet is empty. Please add data to the sheet');
            }
            let data;
            try {
                data = XLSX.utils.sheet_to_json(worksheet, {
                    raw: false,
                    defval: '',
                    blankrows: false,
                });
            }
            catch (jsonError) {
                throw new invalid_format_exception_1.InvalidFormatException('Cannot read Excel data. Please verify file format');
            }
            if (!data || data.length === 0) {
                throw new invalid_format_exception_1.InvalidFormatException('No data found in Excel file. Please add at least one user row');
            }
            const maxRows = 1000;
            if (data.length > maxRows) {
                throw new invalid_format_exception_1.InvalidFormatException(`File contains ${data.length} rows. Maximum ${maxRows} rows allowed`);
            }
            const requiredColumns = ['email', 'username'];
            const firstRow = data[0];
            const missingColumns = requiredColumns.filter(col => !(col in firstRow));
            if (missingColumns.length > 0) {
                throw new invalid_format_exception_1.InvalidFormatException(`Missing required columns: ${missingColumns.join(', ')}. Please download the template`);
            }
            const rows = [];
            let validCount = 0;
            let invalidCount = 0;
            for (let i = 0; i < data.length; i++) {
                const rowData = data[i];
                const rowNumber = i + 2;
                const errors = [];
                try {
                    const hasAnyData = Object.values(rowData).some(val => val !== null && val !== undefined && String(val).trim() !== '');
                    if (!hasAnyData) {
                        continue;
                    }
                    const email = rowData.email !== null && rowData.email !== undefined ? String(rowData.email).trim() : '';
                    if (!email) {
                        errors.push('Email is required');
                    }
                    else if (email.length > 255) {
                        errors.push('Email is too long (max 255 characters)');
                    }
                    else if (!this.isValidEmail(email)) {
                        errors.push('Invalid email format');
                    }
                    const username = rowData.username !== null && rowData.username !== undefined ? String(rowData.username).trim() : '';
                    if (!username) {
                        errors.push('Username is required');
                    }
                    else if (username.length > 100) {
                        errors.push('Username is too long (max 100 characters)');
                    }
                    if (rowData.role !== null && rowData.role !== undefined && String(rowData.role).trim()) {
                        const roleStr = String(rowData.role).trim();
                        const validRoles = Object.values(roles_enum_1.UserRole);
                        if (!validRoles.includes(roleStr)) {
                            errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
                        }
                    }
                    if (rowData.phone !== null && rowData.phone !== undefined && String(rowData.phone).trim()) {
                        const phoneStr = String(rowData.phone).trim();
                        if (phoneStr.length > 20) {
                            errors.push('Phone number is too long (max 20 characters)');
                        }
                        else if (!this.isValidPhone(phoneStr)) {
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
                    if (email && this.isValidEmail(email)) {
                        try {
                            const existingUser = await this.usersRepository.findOne({
                                where: { email },
                            });
                            if (existingUser) {
                                errors.push('Email already exists in system');
                            }
                        }
                        catch (dbError) {
                            errors.push('Could not verify email uniqueness');
                        }
                    }
                    if (rowData.employeeId !== null && rowData.employeeId !== undefined) {
                        const empIdStr = String(rowData.employeeId).trim();
                        if (empIdStr) {
                            try {
                                const existingEmployee = await this.usersRepository.findOne({
                                    where: { employeeId: empIdStr },
                                });
                                if (existingEmployee) {
                                    errors.push('Employee ID already exists in system');
                                }
                            }
                            catch (dbError) {
                                errors.push('Could not verify employee ID uniqueness');
                            }
                        }
                    }
                    const row = {
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
                    }
                    else {
                        invalidCount++;
                    }
                }
                catch (rowError) {
                    const errorRow = {
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
            if (rows.length === 0) {
                throw new invalid_format_exception_1.InvalidFormatException('No valid data found. Please check your file and try again');
            }
            return {
                totalRows: rows.length,
                validRows: validCount,
                invalidRows: invalidCount,
                rows,
            };
        }
        catch (error) {
            if (error instanceof invalid_format_exception_1.InvalidFormatException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new invalid_format_exception_1.InvalidFormatException(`Failed to process file: ${error.message || 'Unknown error'}. Please try again or contact support`);
        }
    }
    async executeUserImport(rows, generateEmployeeId, generateActivationToken) {
        const result = {
            success: true,
            totalProcessed: 0,
            successCount: 0,
            failedCount: 0,
            errors: [],
        };
        try {
            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                throw new invalid_format_exception_1.InvalidFormatException('No data to import. Please upload a file first');
            }
            const validRows = rows.filter(row => row && Array.isArray(row.errors) && row.errors.length === 0);
            if (validRows.length === 0) {
                throw new invalid_format_exception_1.InvalidFormatException('No valid rows to import. Please fix errors and try again');
            }
            result.totalProcessed = validRows.length;
            for (const row of validRows) {
                try {
                    if (!row.email || !row.username) {
                        throw new invalid_format_exception_1.InvalidFormatException('Email and username are required');
                    }
                    let employeeId;
                    try {
                        employeeId = row.employeeId || await generateEmployeeId();
                    }
                    catch (genError) {
                        throw new invalid_format_exception_1.InvalidFormatException(`Cannot generate employee ID: ${genError.message}`);
                    }
                    const activationToken = generateActivationToken();
                    const userData = {
                        employeeId,
                        email: row.email,
                        username: row.username,
                        role: row.role,
                        departmentId: row.departmentId,
                        position: row.position,
                        phone: row.phone,
                        joinDate: row.joinDate ? new Date(row.joinDate) : undefined,
                        status: user_status_enum_1.UserStatus.INACTIVE,
                    };
                    const user = this.usersRepository.create({
                        ...userData,
                        activationToken,
                    });
                    await this.usersRepository.save(user);
                    result.successCount++;
                }
                catch (error) {
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
        }
        catch (error) {
            if (error instanceof invalid_format_exception_1.InvalidFormatException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new invalid_format_exception_1.InvalidFormatException(`Import failed: ${error.message || 'Unknown error'}. Please try again or contact support`);
        }
    }
    async exportUsersToExcel(users) {
        try {
            const data = users.map(user => ({
                employeeId: user.employeeId,
                email: user.email,
                username: user.username,
                role: user.role,
                departmentId: user.departmentId,
                position: user.position,
                phone: user.phone,
                joinDate: user.joinDate ? user.joinDate.toISOString().split('T')[0] : '',
                status: user.status,
                createdAt: user.createdAt.toISOString(),
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 15 },
                { wch: 30 },
                { wch: 20 },
                { wch: 18 },
                { wch: 12 },
                { wch: 25 },
                { wch: 18 },
                { wch: 12 },
                { wch: 12 },
                { wch: 20 },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Users');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            return buffer;
        }
        catch (error) {
            throw new invalid_format_exception_1.InvalidFormatException(`Cannot export users: ${error.message || 'Unknown error'}. Please try again`);
        }
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidPhone(phone) {
        const phoneRegex = /^[\d\s+\-()]+$/;
        return phoneRegex.test(phone);
    }
};
exports.ExcelService = ExcelService;
exports.ExcelService = ExcelService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(users_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ExcelService);
//# sourceMappingURL=excel.service.js.map