import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtCompensatoryMethod } from '@/common/enums/ot-compensatory-method.enum';

export class ApproveCheckinDto {
  @ApiProperty({ example: 1, description: 'Check-in record ID' })
  @Type(() => Number)
  @IsInt()
  checkinId: number;

  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({
    example: '2026-03-15T18:00:00.000Z',
    description: 'Leader-overridden check-in time (ISO 8601). Required when status is MISSED.',
  })
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional({
    example: '2026-03-15T22:00:00.000Z',
    description: 'Leader-overridden check-out time (ISO 8601). Required when status is MISSED.',
  })
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;
  
}
