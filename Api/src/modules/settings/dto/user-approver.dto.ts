import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserApproverDto {
  @ApiProperty({ example: 1, description: 'ID of the approver user' })
  @IsNumber()
  approverId: number;

  @ApiProperty({ example: 1, description: 'ID of the user who created this mapping' })
  @IsNumber()
  createdBy: number;
}
