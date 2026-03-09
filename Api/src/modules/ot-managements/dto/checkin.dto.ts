import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckinDto {
  @ApiProperty({ example: 1, description: 'OT plan employee assignment ID' })
  @IsInt()
  otPlanEmployeeId: number;
}
