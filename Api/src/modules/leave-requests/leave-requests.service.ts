import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@entities/leave-request-notification-recipient.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { User } from '@entities/users.entity';
import { LeaveRequestStatus } from '@common/enums/request_status';
import { RecipientType } from '@common/enums/recipient-type.enum';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { validateLeaveDates, checkLeaveOverlapSimple } from './utils/leave-calculation.utils';
import { AppException, ErrorCode } from '@/common';

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(LeaveRequestNotificationRecipient)
    private notificationRecipientRepository: Repository<LeaveRequestNotificationRecipient>,
    @InjectRepository(UserApprover)
    private userApproverRepository: Repository<UserApprover>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new leave request
   */
  async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    this.logger.log(`[createLeaveRequest] User ${userId} attempting to create leave request: ${JSON.stringify(dto)}`);

    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      this.logger.warn(
        `[createLeaveRequest] Date validation failed for user ${userId}: endDate (${dto.endDate}) is before startDate (${dto.startDate})`,
      );
      throw new AppException(ErrorCode.INVALID_INPUT, 'End date must be after start date', 400);
    }

    // Find active approver for this user
    const userApprover = await this.userApproverRepository.findOne({
      where: { userId, active: true },
      relations: ['approver'],
    });

    if (!userApprover) {
      this.logger.warn(
        `[createLeaveRequest] No active approver found for user ${userId}`,
      );
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'No active approver assigned to this user',
        400,
      );
    }

    if (!dto.reason) {
      this.logger.warn(
        `[createLeaveRequest] Missing reason for user ${userId}`,
      );
      throw new AppException(ErrorCode.INVALID_INPUT, 'Reason for leave request is required', 400);
    }

    // Get requester info
    const requester = await this.userRepository.findOne({ where: { id: userId } });

    if (dto.ccUserIds && dto.ccUserIds.includes(userId)) {
      this.logger.warn(
        `[createLeaveRequest] User ${userId} attempted to CC themselves`,
      );
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'You cannot CC yourself on your own leave request',
        400,
      );
    }

    // Validate ccUserIds: không được chứa approver
    if (dto.ccUserIds && dto.ccUserIds.includes(userApprover.approverId)) {
      this.logger.warn(
        `[createLeaveRequest] User ${userId} included approver ${userApprover.approverId} in CC list`,
      );
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Approver is automatically notified and should not be in CC list',
        400,
      );
    }

    // Validate ccUserIds: không được chứa active HR users
    if (dto.ccUserIds && dto.ccUserIds.length > 0) {
      const hrUsers = await this.userRepository.find({
        where: { role: UserRole.HR, status: UserStatus.ACTIVE },
      });
      const hrUserIds = hrUsers.map((hr) => hr.id);
      const hasHrInCC = dto.ccUserIds.some((id) => hrUserIds.includes(id));
      if (hasHrInCC) {
        this.logger.warn(
          `[createLeaveRequest] User ${userId} included HR user(s) in CC list: ${dto.ccUserIds.filter((id) => hrUserIds.includes(id)).join(', ')}`,
        );
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          'HR users are automatically notified and should not be in CC list',
          400,
        );
      }
    }

    // Check for overlapping leave requests (excluding current request)
    const overlapCheck = await checkLeaveOverlapSimple(
      this.leaveRequestRepository,
      userId,
      dto.startDate,
      dto.endDate,
    );
    if (overlapCheck.hasOverlap) {
      const overlappingDates = overlapCheck.overlappingRequests
        .map((req) => `${req.startDate} to ${req.endDate}`)
        .join(', ');
      this.logger.warn(
        `[createLeaveRequest] Overlap detected for user ${userId}: ${overlappingDates}`,
      );
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `Leave dates overlap with existing request(s): ${overlappingDates}`,
        400,
      );
    }

    // Use transaction to ensure consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create leave request
      const leaveRequest = this.leaveRequestRepository.create({
        userId,
        approverId: userApprover.approverId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason,
        workSolution: dto.workSolution,
        status: LeaveRequestStatus.PENDING,
      });

      const savedRequest = await queryRunner.manager.save(leaveRequest);

      // Add notification recipients
      const recipients: LeaveRequestNotificationRecipient[] = [];

      // 1. Add active HR users (always, except if requester is HR themselves)
      // HR receives notification when request is approved
      // Only include ACTIVE HR users - pending/inactive HR should not receive notifications
      if (requester.role !== UserRole.HR) {
        const hrUsers = await this.userRepository.find({
          where: { role: UserRole.HR, status: UserStatus.ACTIVE },
        });
        for (const hrUser of hrUsers) {
          recipients.push(
            this.notificationRecipientRepository.create({
              requestId: savedRequest.id,
              userId: hrUser.id,
              type: RecipientType.HR,
            }),
          );
        }
      }

      // 2. Add CC recipients (optional from dto - additional users only)
      // CC users also receive notification when request is approved
      if (dto.ccUserIds && dto.ccUserIds.length > 0) {
        for (const ccUserId of dto.ccUserIds) {
          recipients.push(
            this.notificationRecipientRepository.create({
              requestId: savedRequest.id,
              userId: ccUserId,
              type: RecipientType.CC,
            }),
          );
        }
      }

      // Save recipients
      if (recipients.length > 0) {
        await queryRunner.manager.save(recipients);
      }

      await queryRunner.commitTransaction();

      // Reload the saved request to ensure all generated fields (version, timestamps) are populated
      const reloadedRequest = await this.leaveRequestRepository.findOne({
        where: { id: savedRequest.id },
      });

      // Enqueue email notifications (async, outside transaction)
      await this.enqueueLeaveRequestNotifications(
        reloadedRequest,
        requester,
        userApprover.approver,
      );

      this.logger.log(`Leave request ${reloadedRequest.id} created by user ${userId}`);
      return reloadedRequest;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create leave request: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update leave request with optimistic locking
   */
  async updateLeaveRequest(
    requestId: number,
    userId: number,
    dto: UpdateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    requestId = Number(requestId);

    this.logger.log(
      `[updateLeaveRequest] User ${userId} attempting to update leave request ${requestId}`,
    );

    // Validate dates
    try {
      validateLeaveDates(dto.startDate, dto.endDate);
    } catch (error) {
      this.logger.warn(
        `[updateLeaveRequest] Date validation failed for request ${requestId}: ${error.message}`,
      );
      throw error;
    }

    // Check overlap (giữ nguyên)
    const overlapCheck = await checkLeaveOverlapSimple(
      this.leaveRequestRepository,
      userId,
      dto.startDate,
      dto.endDate,
      requestId,
    );

    if (overlapCheck.hasOverlap) {
      const overlappingDates = overlapCheck.overlappingRequests
        .map((req) => `${req.startDate} to ${req.endDate}`)
        .join(', ');
      this.logger.warn(
        `[updateLeaveRequest] Overlap detected for request ${requestId}: ${overlappingDates} (user: ${userId})`,
      );
      throw new BadRequestException(
        `Leave dates overlap with existing request(s): ${overlappingDates}`,
      );
    }

    // Transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let updatedEntity: LeaveRequest;

    try {
      // IMPORTANT: dùng repo từ queryRunner để tránh trộn context
      const leaveRequestRepo = queryRunner.manager.getRepository(LeaveRequest);
      const recipientRepo = queryRunner.manager.getRepository(LeaveRequestNotificationRecipient);

      // Find leave request TRONG transaction (thay vì findOne ở ngoài)
      const leaveRequest = await leaveRequestRepo.findOne({
        where: { id: requestId, userId },
        relations: ['user'],
      });

      if (!leaveRequest) {
        this.logger.warn(
          `[updateLeaveRequest] Leave request ${requestId} not found for user ${userId}`,
        );
        throw new NotFoundException('Leave request not found or you do not have permission');
      }

      // Check pending
      if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
        this.logger.warn(
          `[updateLeaveRequest] Cannot update request ${requestId} with status ${leaveRequest.status} (user: ${userId})`,
        );
        throw new BadRequestException(
          `Cannot update leave request with status: ${leaveRequest.status}. Only pending requests can be updated.`,
        );
      }

      if (!dto.reason) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          'Reason for leave request is required',
          400,
        );
      }

      // Validate ccUserIds: không được chứa chính user
      if (dto.ccUserIds && dto.ccUserIds.includes(userId)) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          'You cannot CC yourself on your own leave request',
          400,
        );
      }

      // Validate ccUserIds: không được chứa approver
      if (dto.ccUserIds && dto.ccUserIds.includes(leaveRequest.approverId)) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          'Approver is automatically notified and should not be in CC list',
          400,
        );
      }

      // Validate ccUserIds: không được chứa active HR users
      if (dto.ccUserIds && dto.ccUserIds.length > 0) {
        const hrUsers = await this.userRepository.find({
          where: { role: UserRole.HR, status: UserStatus.ACTIVE },
        });
        const hrUserIds = hrUsers.map((hr) => hr.id);
        const hasHrInCC = dto.ccUserIds.some((id) => hrUserIds.includes(id));
        if (hasHrInCC) {
          throw new AppException(
            ErrorCode.INVALID_INPUT,
            'HR users are automatically notified and should not be in CC list',
            400,
          );
        }
      }

      // Update fields
      const originalVersion = leaveRequest.version;
      leaveRequest.startDate = dto.startDate;
      leaveRequest.endDate = dto.endDate;
      leaveRequest.reason = dto.reason;
      leaveRequest.workSolution = dto.workSolution ?? leaveRequest.workSolution;

      // Check if CC recipients are being updated
      const isCCUpdated = dto.ccUserIds !== undefined;

      // Save (version auto increment if fields changed)
      updatedEntity = await leaveRequestRepo.save(leaveRequest);
      const versionIncreasedFromFields = updatedEntity.version > originalVersion;

      // Update CC recipients if provided
      if (isCCUpdated) {
        // Remove old CC recipients (only CC type, keep APPROVER and HR)
        await recipientRepo.delete({
          requestId,
          type: RecipientType.CC,
        });

        // Add new CC recipients
        if (dto.ccUserIds.length > 0) {
          const newRecipients = dto.ccUserIds.map((ccUserId) =>
            recipientRepo.create({
              requestId,
              userId: ccUserId,
              type: RecipientType.CC,
            }),
          );

          await recipientRepo.save(newRecipients);
        }

        // IMPORTANT: Force version increment if CC updated but version didn't increase from field changes
        // This ensures approvers must refresh when CC list changes
        if (!versionIncreasedFromFields) {
          leaveRequest.version = updatedEntity.version + 1;
          updatedEntity = await leaveRequestRepo.save(leaveRequest);

          this.logger.log(
            `[updateLeaveRequest] CC recipients updated for request ${requestId}, version force incremented to ${updatedEntity.version}`,
          );
        } else {
          this.logger.log(
            `[updateLeaveRequest] CC recipients updated for request ${requestId}, version already incremented to ${updatedEntity.version}`,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[updateLeaveRequest] Transaction failed for request ${requestId} by user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Load lại đầy đủ SAU transaction để notify (quan trọng: include 'user')
    const updatedRequest = await this.leaveRequestRepository.findOneOrFail({
      where: { id: requestId },
      relations: ['user', 'notificationRecipients', 'notificationRecipients.user'],
    });

    await this.notificationsService.enqueueLeaveRequestUpdatedNotification(
      updatedRequest.id,
      updatedRequest.approverId,
      updatedRequest.notificationRecipients || [],
      {
        requesterName: updatedRequest.user.username,
        startDate: updatedRequest.startDate,
        endDate: updatedRequest.endDate,
        dashboardLink: `${process.env.FRONTEND_URL}/leave-requests/${updatedRequest.id}`,
      },
    );

    this.logger.log(
      `[updateLeaveRequest] Successfully updated request ${requestId} by user ${userId} - New version: ${updatedEntity.version}`,
    );

    // Trả về object đầy đủ relations (tốt hơn return updatedEntity)
    return updatedRequest;
  }

  /**
   * Enqueue email notifications for new leave request
   */
  private async enqueueLeaveRequestNotifications(
    leaveRequest: LeaveRequest,
    requester: User,
    approver: User,
  ) {
    const context = {
      requesterName: requester.username,
      approverName: approver.username,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      leaveRequestId: leaveRequest.id, //for idempotency key
      dashboardLink: `${process.env.FRONTEND_URL}/leave-requests/${leaveRequest.id}`,
    };

    // Notify approver
    await this.notificationsService.enqueueLeaveRequestNotification(
      leaveRequest.id,
      approver.id,
      context,
    );
  }

  /**
   * Approve leave request with optimistic locking
   */
  async approveLeaveRequest(
    requestId: number,
    approverId: number,
    version: number,
  ): Promise<LeaveRequest> {
    const leaveRequest = await this.leaveRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user', 'approver'],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.approverId !== approverId) {
      throw new ForbiddenException('You are not authorized to approve this request');
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot approve request with status: ${leaveRequest.status}`);
    }

    // Optimistic locking check - ensure approver is acting on the latest version
    if (leaveRequest.version !== version) {
      this.logger.warn(
        `[approveLeaveRequest] Version conflict for request ${requestId}: client version ${version}, current version ${leaveRequest.version} (approver: ${approverId})`,
      );
      throw new ConflictException(
        `This leave request has been modified since you last viewed it (your version: ${version}, current version: ${leaveRequest.version}). Please refresh and review the changes before approving.`,
      );
    }

    // Update status
    leaveRequest.status = LeaveRequestStatus.APPROVED;
    leaveRequest.approvedAt = new Date();
    const updated = await this.leaveRequestRepository.save(leaveRequest);

    const recipients = await this.notificationRecipientRepository.find({
      where: { requestId: leaveRequest.id },
      relations: ['user'],
    });
    console.log(
      'Recipients to notify on approval:',
      recipients.map((r) => r.user.username),
    );
    // Enqueue notification to requester
    await this.notificationsService.enqueueLeaveRequestApprovedNotification(
      leaveRequest.id,
      leaveRequest.userId,
      recipients,
      {
        requesterName: leaveRequest.user.username,
        approverName: leaveRequest.approver.username,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        approvedAt: leaveRequest.approvedAt.toISOString(),
        dashboardLink: `${process.env.FRONTEND_URL}/leave-requests/${leaveRequest.id}`,
      },
    );

    this.logger.log(`Leave request ${requestId} approved by user ${approverId}`);
    return updated;
  }

  /**
   * Reject leave request with optimistic locking
   */
  async rejectLeaveRequest(
    requestId: number,
    approverId: number,
    rejectedReason: string,
    version: number,
  ): Promise<LeaveRequest> {
    if (!rejectedReason || rejectedReason.trim().length === 0) {
      throw new BadRequestException('Rejected reason is required');
    }

    const leaveRequest = await this.leaveRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user', 'approver'],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.approverId !== approverId) {
      throw new ForbiddenException('You are not authorized to reject this request');
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject request with status: ${leaveRequest.status}`);
    }

    // Optimistic locking check - ensure approver is acting on the latest version
    if (leaveRequest.version !== version) {
      this.logger.warn(
        `[rejectLeaveRequest] Version conflict for request ${requestId}: client version ${version}, current version ${leaveRequest.version} (approver: ${approverId})`,
      );
      throw new ConflictException(
        `This leave request has been modified since you last viewed it (your version: ${version}, current version: ${leaveRequest.version}). Please refresh and review the changes before rejecting.`,
      );
    }

    // Update status
    leaveRequest.status = LeaveRequestStatus.REJECTED;
    leaveRequest.rejectedAt = new Date();
    leaveRequest.rejectedReason = rejectedReason;
    const updated = await this.leaveRequestRepository.save(leaveRequest);

    const rejectRecipients = await this.notificationRecipientRepository.find({
      where: { requestId: leaveRequest.id },
      relations: ['user'],
    });

    await this.notificationsService.enqueueLeaveRequestRejectedNotification(
      leaveRequest.id,
      leaveRequest.userId,
      rejectRecipients,
      {
        requesterName: leaveRequest.user.username,
        approverName: leaveRequest.approver.username,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        rejectedAt: leaveRequest.rejectedAt.toISOString(),
        rejectedReason: leaveRequest.rejectedReason,
        dashboardLink: `${process.env.FRONTEND_URL}/leave-requests/${leaveRequest.id}`,
      },
    );

    this.logger.log(`Leave request ${requestId} rejected by user ${approverId}`);
    return updated;
  }

  /**
   * Cancel leave request (by requester)
   */
  async cancelLeaveRequest(requestId: number, userId: number): Promise<LeaveRequest> {
    const leaveRequest = await this.leaveRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel request with status: ${leaveRequest.status}`);
    }

    // Load recipients BEFORE transaction deletes them (needed for notification)
    const cancelRecipients = await this.notificationRecipientRepository.find({
      where: { requestId: leaveRequest.id },
      relations: ['user'],
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      leaveRequest.status = LeaveRequestStatus.CANCELLED;
      leaveRequest.cancelledAt = new Date();
      await this.leaveRequestRepository.save(leaveRequest);
      await this.notificationRecipientRepository.delete({ requestId: leaveRequest.id });
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[cancelLeaveRequest] Transaction failed for request ${requestId} by user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.notificationsService.enqueueLeaveRequestCancelledNotification(
      leaveRequest.id,
      leaveRequest.approverId,
      cancelRecipients,
      {
        requesterName: leaveRequest.user.username,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        cancelledAt: leaveRequest.cancelledAt.toISOString(),
        dashboardLink: `${process.env.FRONTEND_URL}/leave-requests/${leaveRequest.id}`,
      },
    );

    this.logger.log(`Leave request ${requestId} cancelled by user ${userId}`);
    return leaveRequest;
  }

  /**
   * Find all leave requests for a user
   */
  async findUserLeaveRequests(userId: number): Promise<LeaveRequest[]> {
    this.logger.log(`[findUserLeaveRequests] Called for userId: ${userId}`);
    try {
      const results = await this.leaveRequestRepository.find({
        where: { userId },
        relations: ['approver', 'notificationRecipients'],
        order: { createdAt: 'DESC' },
      });
      this.logger.log(`[findUserLeaveRequests] Query completed, found ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(`[findUserLeaveRequests] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find leave requests for management view
   * - HR: all requests (all statuses)
   * - Approver: all requests where they are the approver (all statuses)
   */
  async findRequestsForManagement(user: { id: number; role: string }): Promise<LeaveRequest[]> {
    this.logger.log(
      `[findRequestsForManagement] Called for userId: ${user.id}, role: ${user.role}`,
    );
    try {
      let results: LeaveRequest[];

      if (user.role === 'hr') {
        // HR can see all requests regardless of status
        this.logger.log(`[findRequestsForManagement] User is HR, fetching all requests`);
        results = await this.leaveRequestRepository.find({
          relations: ['user', 'approver'],
          order: { createdAt: 'DESC' },
        });
      } else {
        // Approvers see all requests where they are the approver (all statuses)
        this.logger.log(
          `[findRequestsForManagement] User is approver, fetching their assigned requests`,
        );
        results = await this.leaveRequestRepository.find({
          where: {
            approverId: user.id,
          },
          relations: ['user', 'approver'],
          order: { createdAt: 'DESC' },
        });
      }

      this.logger.log(
        `[findRequestsForManagement] Query completed, found ${results.length} results`,
      );
      return results;
    } catch (error) {
      this.logger.error(`[findRequestsForManagement] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find one leave request by ID
   */
  async findOne(id: number): Promise<LeaveRequest> {
    const leaveRequest = await this.leaveRequestRepository.findOne({
      where: { id },
      relations: ['user', 'approver', 'notificationRecipients', 'notificationRecipients.user'],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    return leaveRequest;
  }
}
