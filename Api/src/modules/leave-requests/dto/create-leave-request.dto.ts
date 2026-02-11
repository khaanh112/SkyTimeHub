import { IsDateString, IsOptional, IsString, IsArray, IsInt, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty({
    description: 'Start date of leave (YYYY-MM-DD)',
    example: '2026-02-10',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date of leave (YYYY-MM-DD)',
    example: '2026-02-12',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Reason for leave request',
    example: 'Family vacation',
  })
  @IsString()
  @Length(5, 500)
  reason: string;


  @ApiPropertyOptional({
    description: 'Work solution/handover plan for leave',
    example: 'Handover to John, OT compensation',
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  workSolution?: string;  

  @ApiPropertyOptional({
    description: 'Array of user IDs to CC on notifications',
    example: [2, 3],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  ccUserIds?: number[];
}
