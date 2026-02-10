import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@entities/leave-request-notification-recipient.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { User } from '@entities/users.entity';
import { LeaveRequestStatus } from '@common/enums/request_status';
import { RecipientType } from '@common/enums/recipient-type.enum';
import { UserRole } from '@common/enums/roles.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';

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
    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Find active approver for this user
    const userApprover = await this.userApproverRepository.findOne({
      where: { userId, active: true },
      relations: ['approver'],
    });

    if (!userApprover) {
      throw new BadRequestException('No active approver assigned to this user');
    }

    // Get requester info
    const requester = await this.userRepository.findOne({ where: { id: userId } });

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
        status: LeaveRequestStatus.PENDING,
      });

      const savedRequest = await queryRunner.manager.save(leaveRequest);

      // Add notification recipients
      const recipients: LeaveRequestNotificationRecipient[] = [];

      // 1. Add HR users (if requester is not HR)
      if (requester.role !== UserRole.HR) {
        const hrUsers = await this.userRepository.find({ where: { role: UserRole.HR } });
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

      // 2. Add CC recipients (optional from dto)
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

      // Enqueue email notifications (async, outside transaction)
      await this.enqueueLeaveRequestNotifications(savedRequest, requester, userApprover.approver, recipients);

      this.logger.log(`Leave request ${savedRequest.id} created by user ${userId}`);
      return savedRequest;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create leave request: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  

  /**
   * Enqueue email notifications for new leave request
   */
  private async enqueueLeaveRequestNotifications(
    leaveRequest: LeaveRequest,
    requester: User,
    approver: User,
    recipients: LeaveRequestNotificationRecipient[],
  ) {
    const context = {
      requesterName: requester.username,
      approverName: approver.username,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      reason: leaveRequest.reason,
      leaveRequestId: leaveRequest.id,
      dashboardLink: `${process.env.FRONTEND_URL}/leave-requests/${leaveRequest.id}`,
    };

    // Notify approver
    await this.notificationsService.enqueueLeaveRequestNotification(
      leaveRequest.id,
      approver.id,
      context,
    );

    // Notify HR/CC recipients
    for (const recipient of recipients) {
      await this.notificationsService.enqueueLeaveRequestNotification(
        leaveRequest.id,
        recipient.userId,
        context,
      );
    }
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(requestId: number, approverId: number): Promise<LeaveRequest> {
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

    // Update status
    leaveRequest.status = LeaveRequestStatus.APPROVED;
    leaveRequest.approvedAt = new Date();
    const updated = await this.leaveRequestRepository.save(leaveRequest);

    // Enqueue notification to requester
    await this.notificationsService.enqueueLeaveRequestApprovedNotification(
      leaveRequest.id,
      leaveRequest.userId,
      {
        requesterName: leaveRequest.user.username,
        approverName: leaveRequest.approver.username,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        approvedAt: leaveRequest.approvedAt.toISOString(),
      },
    );

    this.logger.log(`Leave request ${requestId} approved by user ${approverId}`);
    return updated;
  }

  /**
   * Reject leave request
   */
  async rejectLeaveRequest(requestId: number, approverId: number): Promise<LeaveRequest> {
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

    // Update status
    leaveRequest.status = LeaveRequestStatus.REJECTED;
    leaveRequest.rejectedAt = new Date();
    const updated = await this.leaveRequestRepository.save(leaveRequest);

    // Enqueue notification to requester
    await this.notificationsService.enqueueLeaveRequestRejectedNotification(
      leaveRequest.id,
      leaveRequest.userId,
      {
        requesterName: leaveRequest.user.username,
        approverName: leaveRequest.approver.username,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        rejectedAt: leaveRequest.rejectedAt.toISOString(),
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

    leaveRequest.status = LeaveRequestStatus.CANCELLED;
    leaveRequest.cancelledAt = new Date();

    return this.leaveRequestRepository.save(leaveRequest);
  }

  /**
   * Find all leave requests for a user
   */
  async findUserLeaveRequests(userId: number): Promise<LeaveRequest[]> {
    this.logger.log(`[findUserLeaveRequests] Called for userId: ${userId}`);
    try {
      const results = await this.leaveRequestRepository.find({
        where: { userId },
        relations: ['approver'],
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
   * Find pending approvals for an approver
   */
  async findPendingApprovalsForUser(approverId: number): Promise<LeaveRequest[]> {
    this.logger.log(`[findPendingApprovalsForUser] Called for approverId: ${approverId}`);
    try {
      this.logger.log(`[findPendingApprovalsForUser] Starting query...`);
      const results = await this.leaveRequestRepository.find({
        where: {
          approverId,
          status: LeaveRequestStatus.PENDING,
        },
        relations: ['user'],
        order: { createdAt: 'ASC' },
      });
      this.logger.log(`[findPendingApprovalsForUser] Query completed, found ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(`[findPendingApprovalsForUser] Error: ${error.message}`, error.stack);
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
