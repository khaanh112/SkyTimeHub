import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@/common/enums/request_status';
import { LeaveSession } from '@/common/enums/leave-session.enum';
import { ChildbirthMethod } from '@/common/enums/childbirth-method.enum';

// ── Nested DTOs ──────────────────────────────────────────────

/** Minimal user info – no sensitive fields (token, password, etc.) */
export class UserSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiPropertyOptional({ example: 'EMP26001' })
  employeeId?: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  department?: string | null;
}

/** Leave type with category context */
export class LeaveTypeSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'PAID' })
  code: string;

  @ApiProperty({ example: 'Paid Leave' })
  name: string;

  @ApiPropertyOptional()
  category?: { id: number; code: string; name: string } | null;
}

/** One line of the leave-item breakdown (paid / unpaid split) */
export class LeaveRequestItemDto {
  @ApiProperty({ example: 1 })
  leaveTypeId: number;

  @ApiProperty({ example: 'Paid Leave' })
  leaveTypeName: string;

  @ApiProperty({ example: 'PAID' })
  leaveTypeCode: string;

  @ApiProperty({ example: 2.5 })
  amountDays: number;

  @ApiProperty({ example: 2026 })
  periodYear: number;

  @ApiProperty({ example: 3 })
  periodMonth: number;

  @ApiPropertyOptional({ example: 'converted from Policy excess' })
  note?: string | null;
}

/** CC recipient – only what the UI needs to display a chip */
export class CcRecipientDto {
  @ApiProperty({ example: 5 })
  id: number;

  @ApiProperty({ example: 'janedoe' })
  username: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;
}

// ── Main Response DTO ────────────────────────────────────────

export class LeaveRequestDetailsDto {
  @ApiProperty({ example: 123, description: 'Leave request ID' })
  id: number;

  @ApiProperty({ enum: LeaveRequestStatus, example: LeaveRequestStatus.PENDING })
  status: LeaveRequestStatus;

  @ApiProperty({ example: 1, description: 'Optimistic lock version' })
  version: number;

  // ── People ─────────────────────────────────────────────────

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ type: UserSummaryDto })
  requester: UserSummaryDto;

  @ApiProperty({ example: 2 })
  approverId: number;

  @ApiProperty({ type: UserSummaryDto })
  approver: UserSummaryDto;

  // ── Leave type ─────────────────────────────────────────────

  @ApiPropertyOptional({ type: LeaveTypeSummaryDto })
  requestedLeaveType: LeaveTypeSummaryDto | null;

  // ── Date & session ─────────────────────────────────────────

  @ApiProperty({ example: '2026-02-10' })
  startDate: string;

  @ApiProperty({ example: '2026-02-12' })
  endDate: string;

  @ApiProperty({ enum: LeaveSession, example: LeaveSession.AM })
  startSession: LeaveSession;

  @ApiProperty({ enum: LeaveSession, example: LeaveSession.PM })
  endSession: LeaveSession;

  @ApiPropertyOptional({ example: 2.5, description: 'Duration in days (0.5 step)' })
  durationDays: number | null;

  // ── Parental leave ─────────────────────────────────────────

  @ApiPropertyOptional({ example: 1 })
  numberOfChildren?: number | null;

  @ApiPropertyOptional({ enum: ChildbirthMethod })
  childbirthMethod?: ChildbirthMethod | null;

  // ── Content ────────────────────────────────────────────────

  @ApiProperty({ example: 'Family vacation' })
  reason: string;

  @ApiPropertyOptional({ example: 'Handover to John' })
  workSolution?: string | null;

  // ── Items breakdown ────────────────────────────────────────

  @ApiProperty({ type: [LeaveRequestItemDto] })
  items: LeaveRequestItemDto[];

  // ── CC recipients ──────────────────────────────────────────

  @ApiProperty({ type: [Number], example: [5, 8] })
  ccUserIds: number[];

  @ApiProperty({ type: [CcRecipientDto] })
  ccRecipients: CcRecipientDto[];

  // ── Status workflow dates ──────────────────────────────────

  @ApiPropertyOptional({ description: 'Rejection reason (only when rejected)' })
  rejectedReason?: string | null;

  @ApiPropertyOptional({ description: 'Rejection timestamp' })
  rejectedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Approval timestamp' })
  approvedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Cancellation timestamp' })
  cancelledAt?: Date | null;

  // ── Timestamps ─────────────────────────────────────────────

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}