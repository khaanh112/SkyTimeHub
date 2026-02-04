import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiTags } from '@nestjs/swagger/dist/decorators/api-use-tags.decorator';
import { User } from '@entities/users.entity';
import { UserRole } from '@common/enums/roles.enum';
import { ExcelFileInterceptor } from '@/common/interceptors/excelfile.interceptor';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImportUserRow } from './dto/import-user.dto';
import { Roles } from '../authorization/decorators/roles.decorator';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { ExcelService } from '../import/excel.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly excelService: ExcelService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users retrieved successfully.' })
  async getAllUsers(): Promise<User[]> {
    return await this.usersService.getUsers();
  }

  @Get('me/profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile retrieved successfully.' })
  async getCurrentUserProfile(@CurrentUser('id') userId: number): Promise<User> {
    return await this.usersService.getUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully.' })
  async getUserById(@Param('id') id: number): Promise<User> {
    return await this.usersService.getUser(id);
  }

  @Roles(UserRole.HR)
  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully.' })
  async createUser(@Body() user: CreateUserDto): Promise<User> {
    return await this.usersService.createUser(user);
  }

  @Roles(UserRole.HR)
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing user' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  async updateUser(@Param('id') id: number, @Body() user: UpdateUserDto): Promise<User> {
    return this.usersService.updateUser(id, user);
  }

  @Roles(UserRole.HR)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  async deleteUser(@Param('id') id: number): Promise<void> {
    return await this.usersService.deleteUser(id);
  }

  //@Roles(UserRole.HR)
  @Get(':id/activation-link')
  @ApiOperation({ summary: 'Get activation link for a user' })
  @ApiResponse({ status: 200, description: 'Activation link generated successfully.' })
  async getActivationLink(
    @Param('id') id: number,
  ): Promise<{ activationLink: string; token: string }> {
    const token = await this.usersService.getActivationToken(id);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/auth/activate?token=${token}`;

    return {
      activationLink,
      token,
    };
  }

  @Roles(UserRole.HR)
  @Post('import/preview')
  @ApiOperation({ summary: 'Preview import of users from Excel file' })
  @ApiResponse({ status: 200, description: 'Preview generated successfully.' })
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ExcelFileInterceptor)
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return await this.excelService.previewImport(file);
  }

  @Roles(UserRole.HR)
  @Post('import/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute import of users from Excel file' })
  @ApiResponse({ status: 200, description: 'Import executed successfully.' })
  async executeImport(@Body('rows') rows: ImportUserRow[]) {
    return await this.excelService.executeImport(rows);
  }
}
