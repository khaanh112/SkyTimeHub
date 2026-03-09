import { IsInt, IsString, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectOtPlanDto {
  @ApiProperty({ example: 'Budget exceeded for this month', description: 'Rejection reason' })
  @IsString()
  @Length(10, 500)
  rejectedReason: string;

  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;
}
