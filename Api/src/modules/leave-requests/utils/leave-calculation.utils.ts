/**
 * Leave Request Calculation Utilities
 * 
 * Shared functions for calculating leave days, detecting overlaps,
 * and categorizing paid/unpaid leave types.
 * Used by both create and update leave request operations.
 */

import { Repository } from 'typeorm';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestStatus } from '@common/enums/request_status';
import { BadRequestException } from '@nestjs/common';

export interface LeaveDaysCalculation {
  totalDays: number;
  businessDays: number;
  weekendDays: number;
}

export interface OverlapCheckResult {
  hasOverlap: boolean;
  overlappingRequests: LeaveRequest[];
}

export interface LeaveTypeClassification {
  isPaid: boolean;
  leaveType: 'annual' | 'sick' | 'unpaid' | 'other';
  description: string;
}

/**
 * Calculate the number of days between start and end date (inclusive)
 */
export function calculateTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end < start) {
    throw new BadRequestException('End date must be after or equal to start date');
  }
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
  
  return diffDays;
}

/**
 * Calculate business days (excluding weekends)
 */
export function calculateBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let businessDays = 0;
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return businessDays;
}

/**
 * Calculate all leave day metrics
 */
export function calculateLeaveDays(startDate: string, endDate: string): LeaveDaysCalculation {
  const totalDays = calculateTotalDays(startDate, endDate);
  const businessDays = calculateBusinessDays(startDate, endDate);
  const weekendDays = totalDays - businessDays;
  
  return {
    totalDays,
    businessDays,
    weekendDays,
  };
}

/**
 * Check if leave request overlaps with existing requests
 * Excludes cancelled and rejected requests
 * For updates, also excludes the request being updated
 */
export async function checkLeaveOverlap(
  leaveRequestRepository: Repository<LeaveRequest>,
  userId: number,
  startDate: string,
  endDate: string,
  excludeRequestId?: number,
): Promise<OverlapCheckResult> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Find all non-cancelled, non-rejected requests for this user
  const whereConditions: any = {
    userId,
    status: LeaveRequestStatus.PENDING || LeaveRequestStatus.APPROVED,
  };
  
  const existingRequests = await leaveRequestRepository
    .createQueryBuilder('request')
    .where('request.userId = :userId', { userId })
    .andWhere('request.status IN (:...statuses)', { 
      statuses: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] 
    })
    .andWhere(
      '(request.start_date, request.end_date) OVERLAPS (:startDate, :endDate)',
      { startDate, endDate }
    )
    .getMany();
  
  // Filter out the request being updated (if any)
  const overlappingRequests = excludeRequestId
    ? existingRequests.filter(req => req.id !== excludeRequestId)
    : existingRequests;
  
  return {
    hasOverlap: overlappingRequests.length > 0,
    overlappingRequests,
  };
}

/**
 * Alternative overlap check using simple date comparison
 * This is more portable across different database systems
 */
export async function checkLeaveOverlapSimple(
  leaveRequestRepository: Repository<LeaveRequest>,
  userId: number,
  startDate: string,
  endDate: string,
  excludeRequestId?: number,
): Promise<OverlapCheckResult> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Find all non-cancelled, non-rejected requests for this user
  const existingRequests = await leaveRequestRepository.find({
    where: {
      userId,
    },
  });
  
  const overlappingRequests = existingRequests.filter(req => {
    // Skip if it's the request being updated (use == for type-safe comparison)
    if (excludeRequestId != null && Number(req.id) === Number(excludeRequestId)) {
      return false;
    }
    
    // Skip cancelled and rejected requests
    if (req.status === LeaveRequestStatus.CANCELLED || 
        req.status === LeaveRequestStatus.REJECTED) {
      return false;
    }
    
    const reqStart = new Date(req.startDate);
    const reqEnd = new Date(req.endDate);
    
    // Check for overlap: 
    // Two date ranges overlap if start1 <= end2 AND start2 <= end1
    return start <= reqEnd && reqStart <= end;
  });
  
  return {
    hasOverlap: overlappingRequests.length > 0,
    overlappingRequests,
  };
}



/**
 * Classify leave type (paid/unpaid)
 * This is a placeholder for future implementation
 * You can expand this based on your business rules
 */
export function classifyLeaveType(
  startDate: string,
  endDate: string,
  reason?: string,
  leaveType?: string,
): LeaveTypeClassification {
  // TODO: Implement your business logic here
  // For example:
  // - Check against employee's annual leave balance
  // - Determine if it's sick leave (requires medical certificate)
  // - Check if it's unpaid leave
  // - Consider company holidays, etc.
  
  // Placeholder logic
  const totalDays = calculateTotalDays(startDate, endDate);
  
  // Example: If more than 14 days, might be unpaid
  if (totalDays > 14) {
    return {
      isPaid: false,
      leaveType: 'unpaid',
      description: 'Extended leave (exceeds standard paid leave)',
    };
  }
  
  // Default: assume paid annual leave
  return {
    isPaid: true,
    leaveType: 'annual',
    description: 'Annual paid leave',
  };
}

/**
 * Validate leave request dates
 */
export function validateLeaveDates(startDate: string, endDate: string): void {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestException('Invalid date format');
  }
  
  if (end < start) {
    throw new BadRequestException('End date must be after or equal to start date');
  }
  
  // Optional: Prevent backdated requests
  // if (start < today) {
  //   throw new BadRequestException('Cannot create leave request for past dates');
  // }
}

/**
 * Calculate leave request summary
 */
export function getLeaveRequestSummary(startDate: string, endDate: string, reason?: string) {
  const days = calculateLeaveDays(startDate, endDate);
  const classification = classifyLeaveType(startDate, endDate, reason);
  
  return {
    ...days,
    ...classification,
    startDate,
    endDate,
    reason,
  };
}
