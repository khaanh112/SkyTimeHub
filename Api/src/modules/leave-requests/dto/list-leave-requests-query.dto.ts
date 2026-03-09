import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@/common/enums/request_status';

export enum LeaveRequestView {
  PERSONAL = 'personal',
  MANAGEMENT = 'management',
}

export class ListLeaveRequestsQueryDto {
  // ── View ───────────────────────────────────────────────────
  @ApiPropertyOptional({
    enum: LeaveRequestView,
    default: LeaveRequestView.PERSONAL,
    description: 'personal = own requests, management = team/all requests',
  })
  @IsOptional()
  @IsEnum(LeaveRequestView)
  view?: LeaveRequestView = LeaveRequestView.PERSONAL;

  // ── Pagination ─────────────────────────────────────────────
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, enum: [10, 15, 20] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  // ── Filters ────────────────────────────────────────────────

  /** Multi-select status filter: ?status=pending,approved */
  @ApiPropertyOptional({
    description: 'Comma-separated statuses',
    example: 'pending,approved',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const arr = (typeof value === 'string' ? value.split(',') : value) as string[];
    return arr.map((s) => s.trim().toLowerCase());
  })
  status?: LeaveRequestStatus[];

  /** Multi-select leave type filter (leave_type IDs): ?leaveType=1,3,5 */
  @ApiPropertyOptional({
    description: 'Comma-separated leave type IDs',
    example: '1,3,5',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const arr = (typeof value === 'string' ? value.split(',') : value) as string[];
    return arr.map((s) => Number(s.trim())).filter((n) => !isNaN(n));
  })
  leaveType?: number[];

  /** Date range – from (inclusive) */
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Date range – to (inclusive) */
  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  // ── Search ─────────────────────────────────────────────────

  /** Free‐text search (code / reason in personal, + employee name in management) */
  @ApiPropertyOptional({ example: 'LV-001' })
  @IsOptional()
  @IsString()
  q?: string;

  // ── Sort ───────────────────────────────────────────────────

  /**
   * Sort field with optional `-` prefix for DESC.
   * Allowed: startTime, createdAt, status
   * Default: -startTime (latest first)
   */
  @ApiPropertyOptional({ example: '-startTime', default: '-startTime' })
  @IsOptional()
  @IsString()
  sort?: string = '-startTime';
}
