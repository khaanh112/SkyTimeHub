import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsDateString, Length } from 'class-validator';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { UserGender } from '@common/enums/user-genders';
import { ContractType } from '@common/enums/contract-type.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'EMP001', description: 'Employee ID', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  employeeId?: string;

  @ApiPropertyOptional({ example: 'johndoe', description: 'Username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ enum: UserGender, example: UserGender.MALE, description: 'Gender' })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.EMPLOYEE, description: 'User role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    description: 'User status - HR can only change between active, locked, suspended',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 1, description: 'Department ID' })
  @IsOptional()
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

  @ApiPropertyOptional({ example: '0901234567', description: 'Phone number', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
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
