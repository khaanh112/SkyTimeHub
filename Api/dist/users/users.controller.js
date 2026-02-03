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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const users_service_1 = require("./users.service");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const authorization_1 = require("../authorization");
const roles_enum_1 = require("../common/enums/roles.enum");
const authentication_1 = require("../authentication");
let UsersController = class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    async getAllUsers() {
        return await this.usersService.getUsers();
    }
    async getCurrentUserProfile(userId) {
        return await this.usersService.getUser(userId);
    }
    async getUserById(id) {
        return await this.usersService.getUser(id);
    }
    async createUser(user) {
        return await this.usersService.createUser(user);
    }
    async updateUser(id, user) {
        return this.usersService.updateUser(id, user);
    }
    async deleteUser(id) {
        return await this.usersService.deleteUser(id);
    }
    async getActivationLink(id) {
        const token = await this.usersService.getActivationToken(id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const activationLink = `${frontendUrl}/auth/activate?token=${token}`;
        return {
            activationLink,
            token,
        };
    }
    async previewImport(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        return await this.usersService.previewImport(file);
    }
    async executeImport(rows) {
        return await this.usersService.executeImport(rows);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getAllUsers", null);
__decorate([
    (0, common_1.Get)('me/profile'),
    __param(0, (0, authentication_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getCurrentUserProfile", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUserById", null);
__decorate([
    (0, authorization_1.Roles)(roles_enum_1.UserRole.ADMIN, roles_enum_1.UserRole.HR),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "createUser", null);
__decorate([
    (0, authorization_1.Roles)(roles_enum_1.UserRole.ADMIN, roles_enum_1.UserRole.HR),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateUser", null);
__decorate([
    (0, authorization_1.Roles)(roles_enum_1.UserRole.ADMIN, roles_enum_1.UserRole.HR),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "deleteUser", null);
__decorate([
    (0, authorization_1.Roles)(roles_enum_1.UserRole.ADMIN, roles_enum_1.UserRole.HR),
    (0, common_1.Get)(':id/activation-link'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getActivationLink", null);
__decorate([
    (0, authorization_1.Roles)(roles_enum_1.UserRole.HR),
    (0, common_1.Post)('import/preview'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: {
            fileSize: 10 * 1024 * 1024,
            files: 1,
        },
        fileFilter: (req, file, callback) => {
            if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
                return callback(new common_1.BadRequestException('Only Excel files (.xlsx, .xls) are allowed'), false);
            }
            const validMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'application/octet-stream',
            ];
            if (!validMimeTypes.includes(file.mimetype)) {
                return callback(new common_1.BadRequestException('Invalid file type'), false);
            }
            callback(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "previewImport", null);
__decorate([
    (0, authorization_1.Roles)(roles_enum_1.UserRole.HR),
    (0, common_1.Post)('import/execute'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)('rows')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "executeImport", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map