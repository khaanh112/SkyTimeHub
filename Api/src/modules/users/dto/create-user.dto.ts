import {
  IsEmail,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  Length,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';

export class CreateUserDto {
  @ApiPropertyOptional({ example: 'EMP001', description: 'Employee ID', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  employeeId?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'johndoe', description: 'Username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.EMPLOYEE, description: 'User role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE, description: 'User status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Job position',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  position?: string;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number',
    minLength: 10,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(10, 20)
  @Matches(/^[0-9+\-() ]+$/, {
    message: 'Phone number must contain only digits, spaces, and + - ( ) characters',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Join date',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  joinDate?: Date;
}
