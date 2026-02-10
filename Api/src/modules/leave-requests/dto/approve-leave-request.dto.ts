import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ApproveLeaveRequestDto {
  @ApiProperty({
    description:
      'Version number for optimistic locking. Ensures the approver is approving the latest version of the request.',
    example: 1,
  })
  @IsNotEmpty({
    message:
      'Version is required for optimistic locking. Please refresh the page and try again.',
  })
  @Type(() => Number)
  @IsInt({ message: 'Version must be a valid integer' })
  version: number;
}
