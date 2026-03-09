import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveOtPlanDto {
  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;
}
