import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@/common/enums/request_status';

// ── Permission flags for each row ────────────────────────────

export class LeaveRequestPermissionsDto {
  @ApiProperty({ example: true })
  canViewDetail: boolean;

  @ApiProperty({ example: true })
  canUpdate: boolean;

  @ApiProperty({ example: true })
  canCancel: boolean;
}

// ── Single row in the list table ─────────────────────────────

export class LeaveRequestListItemDto {
  @ApiProperty({ example: 70 })
  id: number;

  @ApiProperty({ example: 'LV-070', description: 'Human-readable code derived from ID' })
  code: string;

  @ApiProperty({
    example: ['Bereavement Leave', 'Paid Leave', 'Unpaid Leave'],
    description: 'Distinct leave type names from items',
  })
  leaveTypes: string[];

  @ApiProperty({ example: '2026-03-07T08:30:00+07:00' })
  startTime: string;

  @ApiProperty({ example: '2026-03-19T17:30:00+07:00' })
  endTime: string;

  @ApiProperty({ example: '9 Days', description: 'Human-readable duration label' })
  durationLabel: string;

  @ApiProperty({ example: 'Kha Anh' })
  approverName: string;

  @ApiPropertyOptional({
    example: 'Tran Thu Trang',
    description: 'Only populated in management view',
  })
  employeeName?: string;

  @ApiProperty({ enum: LeaveRequestStatus, example: LeaveRequestStatus.PENDING })
  status: LeaveRequestStatus;

  @ApiPropertyOptional({
    example: null,
    description: 'Reason for rejection (only when status = rejected)',
  })
  rejectedReason: string | null;

  @ApiProperty({ example: 1, description: 'Version for optimistic locking (approve/reject)' })
  version: number;

  @ApiProperty({ type: LeaveRequestPermissionsDto })
  permissions: LeaveRequestPermissionsDto;
}

// ── Pagination metadata ──────────────────────────────────────

export class PageMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 53 })
  total: number;
}

// ── Full paginated response (returned as-is to bypass TransformInterceptor) ──

export class LeaveRequestListResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: [LeaveRequestListItemDto] })
  data: LeaveRequestListItemDto[];

  @ApiProperty({ type: PageMetaDto })
  page: PageMetaDto;
}
