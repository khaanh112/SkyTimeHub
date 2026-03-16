import { IsInt, IsString, IsEnum, Min, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OtCompensatoryMethod } from '@/common/enums/ot-compensatory-method.enum';

export class CheckoutDto {
  @ApiProperty({ example: 1, description: 'Check-in record ID' })
  @Type(() => Number)
  @IsInt()
  checkinId: number;

  @ApiProperty({
    description: 'Work output description (required, 1–1000 chars)',
    example: 'Completed API integration task',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  workOutput: string;

  @ApiProperty({
    enum: OtCompensatoryMethod,
    description: 'Compensation method (required)',
    example: OtCompensatoryMethod.PAID,
  })
  @IsEnum(OtCompensatoryMethod)
  compensatoryMethod: OtCompensatoryMethod;

  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}
