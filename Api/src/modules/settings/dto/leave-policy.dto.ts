import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LeavePolicyDto {
  @ApiProperty({ example: 4, description: 'Minimum compensatory leave duration per request (hours)' })
  @IsNumber()
  @Min(0)
  minCompLeaveDurationHours: number;
}

export class LeavePolicyResponseDto extends LeavePolicyDto {}
