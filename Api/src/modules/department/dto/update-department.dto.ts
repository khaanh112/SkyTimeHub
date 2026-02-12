import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { DepartmentEnum } from '@/common/enums/departments.enum';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  leaderId?: number | null; // cho phép set null để remove leader
}
