import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Length,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOtPlanEmployeeDto {
  @ApiProperty({ example: 5, description: 'Employee user ID' })
  @IsInt()
  employeeId: number;

  @ApiProperty({
    example: '2026-03-08T11:30:00.000Z',
    description: 'Planned start time (ISO 8601)',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2026-03-08T17:30:00.000Z', description: 'Planned end time (ISO 8601)' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ example: 'Fix Bug #123', description: 'Planned task description' })
  @IsString()
  @Length(1, 150)
  plannedTask: string;
}

export class CreateOtPlanDto {
  @ApiProperty({ example: 'OT plan in March', description: 'Plan title' })
  @IsString()
  @Length(1, 100)
  title: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateOtPlanEmployeeDto], description: 'Employee assignments' })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateOtPlanEmployeeDto)
  employees: CreateOtPlanEmployeeDto[];
}
