import { IsInt, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtCompensatoryMethod } from '@/common/enums/ot-compensatory-method.enum';

export class CheckoutDto {
  @ApiProperty({ example: 1, description: 'Check-in record ID' })
  @Type(() => Number)
  @IsInt()
  checkinId: number;

  @ApiPropertyOptional({ description: 'Work output description' })
  @IsOptional()
  @IsString()
  workOutput?: string;

  @ApiPropertyOptional({ enum: OtCompensatoryMethod, description: 'Compensation method' })
  @IsOptional()
  @IsEnum(OtCompensatoryMethod)
  compensatoryMethod?: OtCompensatoryMethod;

  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}
