import { Controller, Get, Post, Put, Delete, Param, Body, UseInterceptors, UploadedFile, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImportUserRow } from './dto/import-user.dto';
import { Roles } from '../authorization';
import { UserRole } from '../common/enums/roles.enum';
import { CurrentUser } from 'src/authentication';

@Controller('users')
export class UsersController {

  constructor(private readonly usersService: UsersService) {}
                                                                                     

  @Get()
  async getAllUsers(): Promise<User[]> {
    return await this.usersService.getUsers();
  }

  
  @Get('me/profile')
  async getCurrentUserProfile(@CurrentUser('id') userId: number): Promise<User> {
    return await this.usersService.getUser(userId);
  }

  
  @Get(':id')
  async getUserById(@Param('id') id: number): Promise<User> {
    return await this.usersService.getUser(id);
  }
  
  
  @Roles(UserRole.ADMIN, UserRole.HR)
  @Post()
  async createUser(@Body() user: CreateUserDto): Promise<User> {
    return await this.usersService.createUser(user);
  }

  @Roles(UserRole.ADMIN, UserRole.HR)
  @Put(':id')
  async updateUser(@Param('id') id: number, 
  @Body() user: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateUser(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.HR)
  @Delete(':id')
  async deleteUser(@Param('id') id: number): Promise<void> {
    return await this.usersService.deleteUser(id);
  }



  @Roles(UserRole.ADMIN, UserRole.HR)
  @Get(':id/activation-link')
  async getActivationLink(@Param('id') id: number): Promise<{ activationLink: string; token: string }> {
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
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1,
    },
    fileFilter: (req, file, callback) => {
      // Check file extension
      if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
        return callback(new BadRequestException('Only Excel files (.xlsx, .xls) are allowed'), false);
      }
      
      // Check mime type
      const validMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream', // Sometimes Excel files come as octet-stream
      ];
      
      if (!validMimeTypes.includes(file.mimetype)) {
        return callback(new BadRequestException('Invalid file type'), false);
      }
      
      callback(null, true);
    },
  }))
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return await this.usersService.previewImport(file);
  }

  @Roles(UserRole.HR)
  @Post('import/execute')
  @HttpCode(HttpStatus.OK)
  async executeImport(@Body('rows') rows: ImportUserRow[]) {
    return await this.usersService.executeImport(rows);
  }
}
