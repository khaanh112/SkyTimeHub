import {
  IsEmail,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'EMP001', description: 'Employee ID', maxLength: 20, required: true })
  @IsNotEmpty({ message: 'Employee ID is required' })
  @IsString()
  @Length(1, 20)
  employeeId: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address', required: true })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'johndoe', description: 'Username', required: true })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  username: string;

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
    example: '2024-01-01',
    description: 'Join date',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  joinDate?: Date;
}
