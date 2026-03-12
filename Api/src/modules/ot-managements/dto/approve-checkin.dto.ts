import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';


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
}
