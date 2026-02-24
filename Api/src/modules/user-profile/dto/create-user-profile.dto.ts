import {
  IsEmail,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@common/enums/roles.enum';
import { UserGender } from '@common/enums/user-genders';
import { ContractType } from '@common/enums/contract-type.enum';

export class CreateUserProfileDto {
  @ApiProperty({ example: 'EMP001', description: 'Employee ID', maxLength: 20 })
  @IsNotEmpty({ message: 'Employee ID is required' })
  @IsString()
  @Length(1, 20)
  employeeId: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'johndoe', description: 'Username' })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  username: string;

  @ApiProperty({ enum: UserGender, example: UserGender.MALE, description: 'Gender' })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsEnum(UserGender)
  gender: UserGender;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.EMPLOYEE, description: 'User role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: 1, description: 'Department ID' })
  @IsOptional()
  @IsNumber()
  departmentId?: number | null;

  @ApiPropertyOptional({ example: 'Software Engineer', description: 'Job position', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  position?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Join date', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  joinDate?: Date;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Official contract date', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  officialContractDate?: Date;

  @ApiPropertyOptional({ example: '0901234567', description: 'Phone number', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '1995-06-15', description: 'Date of birth', type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ example: '123 Main St, Hanoi', description: 'Address', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address?: string;

  @ApiPropertyOptional({ enum: ContractType, example: ContractType.FULL_TIME, description: 'Contract type' })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({ example: 1, description: 'Approver user ID' })
  @IsOptional()
  @IsNumber()
  approverId?: number | null;

  @ApiPropertyOptional({ example: true, description: 'Set user as department leader' })
  @IsOptional()
  @IsBoolean()
  isDepartmentLeader?: boolean;
}
