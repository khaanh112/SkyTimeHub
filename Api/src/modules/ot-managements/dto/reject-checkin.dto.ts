import { IsInt, IsString, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectCheckinDto {
  @ApiProperty({ example: 1, description: 'Check-in record ID' })
  @IsInt()
  checkinId: number;

  @ApiProperty({ example: 'Hours do not match time records', description: 'Rejection reason' })
  @IsString()
  @Length(5, 500)
  rejectedReason: string;

  @ApiProperty({ example: 1, description: 'Version for optimistic locking' })
  @IsInt()
  @Min(1)
  version: number;
}
