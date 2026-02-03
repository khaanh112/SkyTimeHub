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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const users_entity_1 = require("./users.entity");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const roles_enum_1 = require("../common/enums/roles.enum");
const user_status_enum_1 = require("../common/enums/user-status.enum");
const crypto = require("crypto");
const XLSX = require("xlsx");
let UsersService = class UsersService {
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async generateEmployeeId() {
        const year = new Date().getFullYear().toString().slice(-2);
        const prefix = `EMP${year}`;
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
    generateActivationToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    async getUsers() {
        return await this.usersRepository.find({
            relations: ['department'],
        });
    }
    async getUser(id) {
        const user = await this.usersRepository.findOne({
            where: { id },
            relations: ['department'],
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async findByEmail(email) {
        return await this.usersRepository.findOne({
            where: { email },
            relations: ['department'],
        });
    }
    async getUserByEmail(email) {
        return await this.usersRepository.findOne({
            where: { email },
            relations: ['department'],
        });
    }
    async findByEmployeeId(employeeId) {
        return await this.usersRepository.findOne({
            where: { employeeId },
            relations: ['department'],
        });
    }
    async createUser(user) {
        const existingUser = await this.usersRepository.findOne({ where: { email: user.email } });
        if (existingUser) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        if (user.employeeId) {
            const existingEmployee = await this.usersRepository.findOne({ where: { employeeId: user.employeeId } });
            if (existingEmployee) {
                throw new common_1.ConflictException('User with this employee ID already exists');
            }
        }
        if (!user.employeeId) {
            user.employeeId = await this.generateEmployeeId();
        }
        const activationToken = this.generateActivationToken();
        const newUser = this.usersRepository.create({
            ...user,
            activationToken,
        });
        return await this.usersRepository.save(newUser);
    }
    async updateUser(id, user) {
        const existingUser = await this.usersRepository.findOne({ where: { id } });
        if (!existingUser) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.email && user.email !== existingUser.email) {
            const emailExists = await this.usersRepository.findOne({ where: { email: user.email } });
            if (emailExists) {
                throw new common_1.ConflictException('User with this email already exists');
            }
        }
        if (user.employeeId && user.employeeId !== existingUser.employeeId) {
            const employeeIdExists = await this.usersRepository.findOne({ where: { employeeId: user.employeeId } });
            if (employeeIdExists) {
                throw new common_1.ConflictException('User with this employee ID already exists');
            }
        }
        const updatedUser = this.usersRepository.merge(existingUser, user);
        return await this.usersRepository.save(updatedUser);
    }
    async updateRefreshToken(userId, refreshTokenHash) {
        if (!userId) {
            throw new common_1.BadRequestException('User ID is required');
        }
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        await this.usersRepository.update({ id: userId }, { refreshTokenHash });
    }
    async deleteUser(id) {
        const existingUser = await this.usersRepository.findOne({ where: { id } });
        if (!existingUser) {
            throw new common_1.NotFoundException('User not found');
        }
        await this.usersRepository.delete(id);
    }
    async activateAccount(token) {
        const user = await this.usersRepository.findOne({
            where: { activationToken: token },
        });
        if (!user) {
            throw new common_1.BadRequestException('Invalid activation token');
        }
        user.status = user_status_enum_1.UserStatus.ACTIVE;
        user.activatedAt = new Date();
        user.activationToken = null;
        return await this.usersRepository.save(user);
    }
    async resendActivation(userId) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.status === user_status_enum_1.UserStatus.ACTIVE) {
            throw new common_1.BadRequestException('User account is already active');
        }
        user.activationToken = this.generateActivationToken();
        return await this.usersRepository.save(user);
    }
    async getActivationToken(userId) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.status === user_status_enum_1.UserStatus.ACTIVE) {
            throw new common_1.BadRequestException('User account is already active');
        }
        if (!user.activationToken) {
            throw new common_1.BadRequestException('No activation token found for this user');
        }
        return user.activationToken;
    }
    async previewImport(file) {
        try {
            if (!file) {
                throw new common_1.BadRequestException('No file uploaded');
            }
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                throw new common_1.BadRequestException('File size exceeds 10MB limit');
            }
            if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
                throw new common_1.BadRequestException('Only Excel files (.xlsx, .xls) are allowed');
            }
            const validMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
            ];
            if (file.mimetype && !validMimeTypes.includes(file.mimetype)) {
                throw new common_1.BadRequestException('Invalid file type. Upload a valid Excel file');
            }
            if (!file.buffer || file.buffer.length === 0) {
                throw new common_1.BadRequestException('Uploaded file is empty or corrupted');
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
                throw new common_1.BadRequestException('Failed to parse Excel file. File may be corrupted or password-protected');
            }
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new common_1.BadRequestException('Excel file has no sheets');
            }
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new common_1.BadRequestException('First sheet is empty or invalid');
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
                throw new common_1.BadRequestException('Failed to read sheet data. Check Excel format');
            }
            if (!data || data.length === 0) {
                throw new common_1.BadRequestException('Excel file has no data rows (header row found but no data)');
            }
            const maxRows = 1000;
            if (data.length > maxRows) {
                throw new common_1.BadRequestException(`Too many rows. Maximum ${maxRows} rows allowed, found ${data.length}`);
            }
            const requiredColumns = ['email', 'username'];
            const firstRow = data[0];
            const missingColumns = requiredColumns.filter(col => !(col in firstRow));
            if (missingColumns.length > 0) {
                throw new common_1.BadRequestException(`Missing required columns: ${missingColumns.join(', ')}. Download the template for correct format`);
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
                            const existingUser = await this.findByEmail(email);
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
                                const existingEmployee = await this.findByEmployeeId(empIdStr);
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
                throw new common_1.BadRequestException('No valid rows found in Excel file');
            }
            return {
                totalRows: rows.length,
                validRows: validCount,
                invalidRows: invalidCount,
                rows,
            };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Failed to process Excel file: ${error.message || 'Unknown error'}. Please ensure file is not corrupted and follows the template format.`);
        }
    }
    async executeImport(rows) {
        const result = {
            success: true,
            totalProcessed: 0,
            successCount: 0,
            failedCount: 0,
            errors: [],
        };
        try {
            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                throw new common_1.BadRequestException('No rows provided for import');
            }
            const validRows = rows.filter(row => row && Array.isArray(row.errors) && row.errors.length === 0);
            if (validRows.length === 0) {
                throw new common_1.BadRequestException('No valid rows to import');
            }
            result.totalProcessed = validRows.length;
            for (const row of validRows) {
                try {
                    if (!row.email || !row.username) {
                        throw new Error('Missing required fields');
                    }
                    let employeeId;
                    try {
                        employeeId = row.employeeId || await this.generateEmployeeId();
                    }
                    catch (genError) {
                        throw new Error(`Failed to generate employee ID: ${genError.message}`);
                    }
                    const activationToken = this.generateActivationToken();
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
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Import failed: ${error.message || 'Unknown error'}`);
        }
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidPhone(phone) {
        const phoneRegex = /^[0-9+\-() ]+$/;
        return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_2.InjectRepository)(users_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_1.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map