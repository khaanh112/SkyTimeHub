import { IsEmail, IsEnum, IsString, IsOptional, IsDateString, IsInt, Length, Matches } from "class-validator";
import { UserRole } from "../../common/enums/roles.enum";
import { UserStatus } from "../../common/enums/user-status.enum";

export class CreateUserDto {
  
  @IsOptional()
  @IsString()
  @Length(1, 20)
  employeeId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  position?: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  @Matches(/^[0-9+\-() ]+$/, { message: 'Phone number must contain only digits, spaces, and + - ( ) characters' })
  phone?: string;

  @IsOptional()
  @IsDateString()
  joinDate?: Date;
}