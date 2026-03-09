import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OtPolicyDto {
  @ApiProperty({ example: 4, description: 'Max OT hours per day (regular days)' })
  @IsNumber()
  @Min(0)
  maxOtHoursPerDay: number;

  @ApiProperty({ example: 8, description: 'Max OT hours per day (rest days & holidays)' })
  @IsNumber()
  @Min(0)
  maxOtHoursPerDayHoliday: number;

  @ApiProperty({ example: 40, description: 'Max OT hours per month' })
  @IsNumber()
  @Min(0)
  maxOtHoursPerMonth: number;

  @ApiProperty({ example: 200, description: 'Max OT hours per year' })
  @IsNumber()
  @Min(0)
  maxOtHoursPerYear: number;
}

export class OtPolicyResponseDto extends OtPolicyDto {}
