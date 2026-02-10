import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@common/enums/request_status';

export class UpdateLeaveRequestStatusDto {
  @ApiProperty({ 
    enum: LeaveRequestStatus, 
    example: LeaveRequestStatus.APPROVED,
    description: 'New status for the leave request'
  })
  @IsEnum(LeaveRequestStatus)
  status: LeaveRequestStatus;
}
