import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsDateString, Length } from 'class-validator';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';

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
