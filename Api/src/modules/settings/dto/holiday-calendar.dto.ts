import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HolidayItemDto {
  @ApiProperty({ example: 'International New Year', description: 'Holiday name' })
  @IsString()
  @IsNotEmpty({ message: 'Holiday name is required' })
  name: string;

  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty({ message: 'Start date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must be in YYYY-MM-DD format' })
  startDate: string;

  @ApiProperty({ example: '2026-01-01', description: 'End date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty({ message: 'End date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'End date must be in YYYY-MM-DD format' })
  endDate: string;

  @ApiPropertyOptional({
    example: '2026-01-04',
    description: 'Compensatory working day (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Compensatory date must be in YYYY-MM-DD format',
  })
  compensatoryDate?: string;
}

export class SaveHolidayCalendarDto {
  @ApiProperty({ example: 2026, description: 'Year for the holiday calendar' })
  @IsNumber()
  year: number;

  @ApiProperty({ type: [HolidayItemDto], description: 'List of holidays' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HolidayItemDto)
  holidays: HolidayItemDto[];
}
