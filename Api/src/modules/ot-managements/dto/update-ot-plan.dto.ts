import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateOtPlanDto } from './create-ot-plan.dto';

export class UpdateOtPlanDto extends CreateOtPlanDto {
  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;
}
