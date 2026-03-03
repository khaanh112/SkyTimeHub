import {
  IsEmail,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  Length,
  IsDefined,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { UserGender } from '@common/enums/user-genders';
import { ContractType } from '@common/enums/contract-type.enum';

export class CreateUserDto {

  @ApiPropertyOptional({ example: 'SG100', description: 'Employee ID (auto-generated if not provided)', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  employeeId?: string;


  @ApiProperty({ example: 'user@example.com', description: 'User email address', required: true })
  @IsEmail()
  @IsDefined({ message: 'Email is required' })
  email: string;


  @ApiProperty({ example: 'johndoe', description: 'Username', required: true })
  @IsDefined({ message: 'Username is required' })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  username: string;


  @ApiProperty({
    enum: UserGender,
    example: UserGender.MALE,
    description: 'Gender',
    required: true,
  })
  @IsDefined({ message: 'Gender is required' })
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

  @ApiPropertyOptional({ example: '0901234567', description: 'Phone number', maxLength: 11 })
  @IsOptional()
  @IsString()
  @Length(9, 11)
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '1995-06-15',
    description: 'Date of birth',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ example: '123 Main St, Hanoi', description: 'Address', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address?: string;

  @ApiPropertyOptional({ enum: ContractType, example: ContractType.OFFICIAL, description: 'Contract type' })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;
}
