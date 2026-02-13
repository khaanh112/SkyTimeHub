import {
  IsEmail,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { UserGender } from '@common/enums/user-genders';

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

  @ApiProperty({
    enum: UserGender,
    example: UserGender.MALE,
    description: 'Gender',
    required: true,
  })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsEnum(UserGender)
  gender: UserGender;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.EMPLOYEE, description: 'User role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE, description: 'User status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 1, description: 'Department ID' })
  departmentId?: number | null;

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

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Official contract date',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  officialContractDate?: Date;
}
