import {
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  IsEnum,
  IsBoolean,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LeaveSession } from '@/common/enums/leave-session.enum';
import { ChildbirthMethod } from '@/common/enums/childbirth-method.enum';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Leave type ID (from leave_types table)', example: 1 })
  @Type(() => Number)
  @IsInt()
  leaveTypeId: number;

  @ApiProperty({
    description: 'Start date of leave (YYYY-MM-DD)',
    example: '2026-02-10',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date of leave (YYYY-MM-DD)',
    example: '2026-02-12',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({ enum: LeaveSession, description: 'Start session (AM or PM)', example: 'AM' })
  @IsEnum(LeaveSession)
  startSession: LeaveSession;

  @ApiProperty({ enum: LeaveSession, description: 'End session (AM or PM)', example: 'PM' })
  @IsEnum(LeaveSession)
  endSession: LeaveSession;

  @ApiProperty({
    description: 'Reason for leave request',
    example: 'Family vacation',
  })
  @IsString()
  @Length(5, 500)
  reason: string;

  @ApiPropertyOptional({
    description: 'Work solution/handover plan for leave',
    example: 'Handover to John, OT compensation',
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  workSolution?: string;

  @ApiPropertyOptional({
    description: 'Array of user IDs to CC on notifications',
    example: [2, 3],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  ccUserIds?: number[];

  @ApiPropertyOptional({
    description: 'Number of children (for parental leave)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  numberOfChildren?: number;

  @ApiPropertyOptional({
    description: 'Childbirth method: natural or c_section (for parental leave)',
    enum: ChildbirthMethod,
    example: ChildbirthMethod.NATURAL,
  })
  @IsOptional()
  @IsEnum(ChildbirthMethod)
  childbirthMethod?: ChildbirthMethod;

  @ApiPropertyOptional({
    description: 'Confirm proceeding despite balance warning',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmDespiteWarning?: boolean;
}
