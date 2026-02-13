import { IsString, IsNotEmpty, MinLength, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RejectLeaveRequestDto {
  @ApiProperty({
    example: 'Not enough staff coverage during this period',
    description: 'Reason for rejecting the leave request',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejected reason is required when rejecting a leave request' })
  @MinLength(10, { message: 'Rejected reason must be at least 10 characters' })
  rejectedReason: string;

  @ApiProperty({
    description:
      'Version number for optimistic locking. Ensures the approver is rejecting the latest version of the request.',
    example: 1,
  })
  @IsNotEmpty({
    message: 'Version is required for optimistic locking. Please refresh the page and try again.',
  })
  @Type(() => Number)
  @IsInt({ message: 'Version must be a valid integer' })
  version: number;
}
