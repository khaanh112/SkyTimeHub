import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { DepartmentEnum } from '@/common/enums/departments.enum';

export class CreateDepartmentDto {
  @ApiProperty({ enum: DepartmentEnum })
  @IsEnum(DepartmentEnum)
  name: DepartmentEnum;

  @ApiPropertyOptional({ example: 12, description: 'Leader user id' })
  @IsOptional()
  @IsInt()
  @Min(1)
  leaderId?: number;
}
