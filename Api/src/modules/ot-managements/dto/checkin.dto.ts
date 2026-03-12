import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CheckinDto {
  @ApiProperty({ example: 1, description: 'OT plan employee assignment ID' })
  @Type(() => Number)
  @IsInt()
  otPlanEmployeeId: number;
}
