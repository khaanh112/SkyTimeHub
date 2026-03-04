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
import { LeaveRequestItem } from '@entities/leave-request-item.entity';
import { LeaveType } from '@entities/leave-type.entity';
import { LeaveCategory } from '@entities/leave-category.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { User } from '@entities/users.entity';
import { LeaveRequestStatus } from '@common/enums/request_status';
import { RecipientType } from '@common/enums/recipient-type.enum';
import { UserRole } from '@common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { LeaveBalanceService } from './leave-balance.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveRequestDetailsDto } from './dto/leave-request-details.dto';
import { AppException, ErrorCode } from '@/common';

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(LeaveRequestNotificationRecipient)
    private notificationRecipientRepository: Repository<LeaveRequestNotificationRecipient>,
    @InjectRepository(LeaveRequestItem)
    private leaveRequestItemRepository: Repository<LeaveRequestItem>,
    @InjectRepository(LeaveType)
    private leaveTypeRepository: Repository<LeaveType>,
    @InjectRepository(LeaveCategory)
    private leaveCategoryRepository: Repository<LeaveCategory>,
    @InjectRepository(UserApprover)
    private userApproverRepository: Repository<UserApprover>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private leaveBalanceService: LeaveBalanceService,
  ) {}

  /**
   * Compute half-day slot index from date + session.
   * Matches the DB trigger: (date - '2000-01-01') * 2 + (PM ? 1 : 0)
   */
  private dateToSlot(date: string, session: string): number {
    const epoch = new Date('2000-01-01T00:00:00');
    const d = new Date(date + 'T00:00:00');
    const daysDiff = Math.round((d.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff * 2 + (session === 'PM' ? 1 : 0);
  }

  /**
   * Check for overlapping active (pending/approved) leave requests.
   * Throws user-friendly error if overlap found.
   * @param excludeRequestId - exclude this request ID (for update flow)
   */
  private async checkOverlap(
    userId: number,
    startDate: string,
    startSession: string,
    endDate: string,
    endSession: string,
    excludeRequestId?: number,
  ): Promise<void> {
    const newStart = this.dateToSlot(startDate, startSession);
    const newEnd = this.dateToSlot(endDate, endSession);

    // Find any active request whose slot range overlaps [newStart, newEnd]
    let qb = this.leaveRequestRepository
      .createQueryBuilder('lr')
      .where('lr.user_id = :userId', { userId })
      .andWhere('lr.status IN (:...statuses)', { statuses: ['pending', 'approved'] })
      .andWhere('lr.start_slot <= :newEnd AND lr.end_slot >= :newStart', { newStart, newEnd });

    if (excludeRequestId) {
      qb = qb.andWhere('lr.id != :excludeId', { excludeId: excludeRequestId });
    }

    const conflict = await qb.getOne();

    if (conflict) {
      const fmt = (d: string) => {
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      };
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `This leave request overlaps with an existing ${conflict.status} request (${fmt(conflict.startDate)} – ${fmt(conflict.endDate)}). Please choose different dates.`,
        409,
      );
    }
  }

  /**
   * Create a new leave request
   */
  async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    this.logger.log(`[createLeaveRequest] User ${userId} creating leave request: ${JSON.stringify(dto)}`);

    //  Basic validation 
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'End date must be after start date', 400);
    }
    
    //  Approver lookup 
    const userApprover = await this.userApproverRepository.findOne({
      where: { userId, active: true },
      relations: ['approver'],
    });

    if (!userApprover) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'No active approver assigned to this user', 400);
    }

    const requester = await this.userRepository.findOne({ where: { id: userId } });

    // CC validation 
    if (dto.ccUserIds?.includes(userId)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'You cannot CC yourself on your own leave request', 400);
    }
    if (dto.ccUserIds?.includes(userApprover.approverId)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Approver is automatically notified and should not be in CC list', 400);
    }
    if (dto.ccUserIds?.length > 0) {
      const hrUsers = await this.userRepository.find({ where: { role: UserRole.HR, status: UserStatus.ACTIVE } });
      const hrUserIds = hrUsers.map((hr) => hr.id);
      if (dto.ccUserIds.some((id) => hrUserIds.includes(id))) {
        throw new AppException(ErrorCode.INVALID_INPUT, 'HR users are automatically notified and should not be in CC list', 400);
      }
    }

    // ── Overlap check 
    await this.checkOverlap(userId, dto.startDate, dto.startSession, dto.endDate, dto.endSession);

    // Logic complex, too big function, double call validateandprepare, n+1 problem, race condition?, missmatch leave items and balance: không lưu unpaid leave balance

  // Preview warning and real saved data can be different, need checking version before submit
    // ── Pre-flight validation (outside transaction, for warnings) ─
    const preValidation = await this.leaveBalanceService.validateAndPrepare(
      userId,
      dto.leaveTypeId,
      dto.startDate,
      dto.endDate,
      dto.startSession,
      dto.endSession,
      undefined,
      {
        numberOfChildren: dto.numberOfChildren,
        childbirthMethod: dto.childbirthMethod,
      },
    );

    // If there are warnings and user hasn't confirmed
    if (preValidation.warnings.length > 0 && !dto.confirmDespiteWarning) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        JSON.stringify({ requiresConfirmation: true, warnings: preValidation.warnings, durationDays: preValidation.durationDays, items: preValidation.items }),
        400,
      );
    }


    // Sai logic ở chỗ này, dù có warning hay không thì endDate và endSession vẫn là user input, không bị override bởi hệ thống. Nếu có override thì sẽ gây ra sự nhầm lẫn cho người dùng vì họ đã chọn ngày này rồi mà hệ thống lại đổi thành ngày khác, dù có warning hay không thì cũng phải giữ nguyên ngày người dùng chọn, warning chỉ là cảnh báo về việc có thể bị trừ nhiều ngày phép hơn dự kiến thôi chứ không phải là cảnh báo về việc hệ thống sẽ đổi ngày của họ. Cần sửa lại phần này để luôn sử dụng endDate và endSession do người dùng cung cấp, không bị override bởi hệ thống dù có warning hay không.
    // Always use user-provided endDate and endSession (no auto-override)
    const finalEndDate = dto.endDate;
    const finalEndSession = dto.endSession;

    // ── Transaction (advisory lock + reserve) ────────────────
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create leave request first to get ID for source_id in transactions
      const leaveRequest = this.leaveRequestRepository.create({
        userId,
        approverId: userApprover.approverId,
        requestedLeaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: finalEndDate,
        startSession: dto.startSession,
        endSession: finalEndSession,
        durationDays: preValidation.durationDays,
        reason: dto.reason,
        workSolution: dto.workSolution,
        numberOfChildren: dto.numberOfChildren ?? null,
        childbirthMethod: dto.childbirthMethod ?? null,
        status: LeaveRequestStatus.PENDING,
      });

      const savedRequest = await queryRunner.manager.save(leaveRequest);

      // Reserve balance under advisory lock (re-validates inside tx)
      const validation = await this.leaveBalanceService.reserveBalanceForSubmit(
        queryRunner.manager,
        userId,
        savedRequest.id,
        dto.leaveTypeId,
        dto.startDate,
        dto.endDate,
        dto.startSession,
        dto.endSession,
        undefined,
        {
          numberOfChildren: dto.numberOfChildren,
          childbirthMethod: dto.childbirthMethod,
        },
      );

      // Save leave request items with per-month allocation
      if (validation.monthlyAllocations.length > 0) {
        const items = validation.monthlyAllocations.map((alloc) =>
          this.leaveRequestItemRepository.create({
            leaveRequestId: savedRequest.id,
            leaveTypeId: alloc.leaveTypeId,
            amountDays: alloc.amountDays,
            periodYear: alloc.year,
            periodMonth: alloc.month,
            note: alloc.note,
          }),
        );
        await queryRunner.manager.save(items);
      } else if (validation.items.length > 0) {
        // Fallback: non-monthly types (policy/social) — use request year/month
        const requestYear = new Date(dto.startDate).getFullYear();
        const requestMonth = new Date(dto.startDate).getMonth() + 1;
        const items = validation.items.map((item) =>
          this.leaveRequestItemRepository.create({
            leaveRequestId: savedRequest.id,
            leaveTypeId: item.leaveTypeId,
            amountDays: item.amountDays,
            periodYear: requestYear,
            periodMonth: requestMonth,
            note: item.note,
          }),
        );
        await queryRunner.manager.save(items);
      }

      //end problem



      // Add notification recipients
      const recipients: LeaveRequestNotificationRecipient[] = [];

      // HR users (auto)
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

      // CC recipients (user-selected)
      if (dto.ccUserIds?.length > 0) {
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

      if (recipients.length > 0) {
        await queryRunner.manager.save(recipients);
      }

      await queryRunner.commitTransaction();

      // Reload with all generated fields
      const reloadedRequest = await this.leaveRequestRepository.findOne({
        where: { id: savedRequest.id },
        relations: ['items', 'items.leaveType'],
      });

      // Enqueue notifications (async, outside transaction)
      await this.enqueueLeaveRequestNotifications(reloadedRequest, requester, userApprover.approver);

      this.logger.log(`Leave request ${reloadedRequest.id} created by user ${userId} — ${validation.durationDays} days, ${validation.items.length} item(s)`);
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

    this.logger.log(`[updateLeaveRequest] User ${userId} updating leave request ${requestId}`);

    // ── Basic validation ─────────────────────────────────────
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'End date must be after start date', 400);
    }


    // ── Find & authorise ─────────────────────────────────────
    const leaveRequest = await this.leaveRequestRepository.findOne({
      where: { id: requestId, userId },
      relations: ['user'],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found or you do not have permission');
    }
    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot update leave request with status: ${leaveRequest.status}. Only pending requests can be updated.`,
      );
    }

    // ── CC validation ────────────────────────────────────────
    if (dto.ccUserIds?.includes(userId)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'You cannot CC yourself on your own leave request', 400);
    }
    if (dto.ccUserIds?.includes(leaveRequest.approverId)) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Approver is automatically notified and should not be in CC list', 400);
    }
    if (dto.ccUserIds?.length > 0) {
      const hrUsers = await this.userRepository.find({ where: { role: UserRole.HR, status: UserStatus.ACTIVE } });
      const hrUserIds = hrUsers.map((hr) => hr.id);
      if (dto.ccUserIds.some((id) => hrUserIds.includes(id))) {
        throw new AppException(ErrorCode.INVALID_INPUT, 'HR users are automatically notified and should not be in CC list', 400);
      }
    }

    // ── Overlap check (exclude current request) ─────────────
    await this.checkOverlap(userId, dto.startDate, dto.startSession, dto.endDate, dto.endSession, requestId);

    // ── Pre-flight validation (outside transaction, for warnings) ─
    const preValidation = await this.leaveBalanceService.validateAndPrepare(
      userId,
      dto.leaveTypeId,
      dto.startDate,
      dto.endDate,
      dto.startSession,
      dto.endSession,
      requestId, // exclude current request from balance calculations
      {
        numberOfChildren: dto.numberOfChildren,
        childbirthMethod: dto.childbirthMethod,
      },
    );

    if (preValidation.warnings.length > 0 && !dto.confirmDespiteWarning) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        JSON.stringify({ requiresConfirmation: true, warnings: preValidation.warnings, durationDays: preValidation.durationDays, items: preValidation.items }),
        400,
      );
    }

    // Always use user-provided endDate and endSession (no auto-override)
    const finalEndDate = dto.endDate;
    const finalEndSession = dto.endSession;

    // ── Transaction (release old reserves → re-reserve) ──────
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let updatedEntity: LeaveRequest;

    try {
      const leaveRequestRepo = queryRunner.manager.getRepository(LeaveRequest);
      const recipientRepo = queryRunner.manager.getRepository(LeaveRequestNotificationRecipient);
      const itemRepo = queryRunner.manager.getRepository(LeaveRequestItem);

      // Release old RESERVE transactions first
      await this.leaveBalanceService.releaseReserveForRejection(
        userId,
        requestId,
        queryRunner.manager,
      );

      const originalVersion = leaveRequest.version;

      // Update fields
      leaveRequest.requestedLeaveTypeId = dto.leaveTypeId;
      leaveRequest.startDate = dto.startDate;
      leaveRequest.endDate = finalEndDate;
      leaveRequest.startSession = dto.startSession;
      leaveRequest.endSession = finalEndSession;
      leaveRequest.durationDays = preValidation.durationDays;
      leaveRequest.reason = dto.reason;
      leaveRequest.workSolution = dto.workSolution ?? leaveRequest.workSolution;
      leaveRequest.numberOfChildren = dto.numberOfChildren ?? leaveRequest.numberOfChildren;
      leaveRequest.childbirthMethod = dto.childbirthMethod ?? leaveRequest.childbirthMethod;

      updatedEntity = await leaveRequestRepo.save(leaveRequest);
      const versionIncreasedFromFields = updatedEntity.version > originalVersion;

      // Delete old items
      await itemRepo.delete({ leaveRequestId: requestId });

      // Re-reserve under advisory lock (re-validates inside tx)
      const validation = await this.leaveBalanceService.reserveBalanceForSubmit(
        queryRunner.manager,
        userId,
        requestId,
        dto.leaveTypeId,
        dto.startDate,
        dto.endDate,
        dto.startSession,
        dto.endSession,
        requestId, // exclude this request from balance (since RELEASE was already inserted)
        {
          numberOfChildren: dto.numberOfChildren,
          childbirthMethod: dto.childbirthMethod,
        },
      );

      // Insert new items with per-month allocation
      if (validation.monthlyAllocations.length > 0) {
        const items = validation.monthlyAllocations.map((alloc) =>
          itemRepo.create({
            leaveRequestId: requestId,
            leaveTypeId: alloc.leaveTypeId,
            amountDays: alloc.amountDays,
            periodYear: alloc.year,
            periodMonth: alloc.month,
            note: alloc.note,
          }),
        );
        await itemRepo.save(items);
      } else if (validation.items.length > 0) {
        const requestYear = new Date(dto.startDate).getFullYear();
        const requestMonth = new Date(dto.startDate).getMonth() + 1;
        const items = validation.items.map((item) =>
          itemRepo.create({
            leaveRequestId: requestId,
            leaveTypeId: item.leaveTypeId,
            amountDays: item.amountDays,
            periodYear: requestYear,
            periodMonth: requestMonth,
            note: item.note,
          }),
        );
        await itemRepo.save(items);
      }

      // Update CC recipients if provided
      const isCCUpdated = dto.ccUserIds !== undefined;
      if (isCCUpdated) {
        await recipientRepo.delete({ requestId, type: RecipientType.CC });

        if (dto.ccUserIds.length > 0) {
          const newRecipients = dto.ccUserIds.map((ccUserId) =>
            recipientRepo.create({ requestId, userId: ccUserId, type: RecipientType.CC }),
          );
          await recipientRepo.save(newRecipients);
        }

        if (!versionIncreasedFromFields) {
          leaveRequest.version = updatedEntity.version + 1;
          updatedEntity = await leaveRequestRepo.save(leaveRequest);
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[updateLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Reload with full relations
    const updatedRequest = await this.leaveRequestRepository.findOneOrFail({
      where: { id: requestId },
      relations: ['user', 'notificationRecipients', 'notificationRecipients.user', 'items', 'items.leaveType'],
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

    this.logger.log(`[updateLeaveRequest] Successfully updated request ${requestId} — version: ${updatedEntity.version}`);
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
      relations: ['user', 'approver', 'items'],
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

    // Optimistic locking check
    if (leaveRequest.version !== version) {
      throw new ConflictException(
        `This leave request has been modified since you last viewed it (your version: ${version}, current version: ${leaveRequest.version}). Please refresh and review the changes before approving.`,
      );
    }

    // ── Transaction: approve + convert RESERVE → APPROVAL ──
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let updated: LeaveRequest;
    try {
      // Update status
      leaveRequest.status = LeaveRequestStatus.APPROVED;
      leaveRequest.approvedAt = new Date();
      updated = await queryRunner.manager.save(leaveRequest);

      // Convert RESERVE debits to APPROVAL debits (in-place update)
      await this.leaveBalanceService.convertReserveToApproval(
        leaveRequest.userId,
        leaveRequest.id,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[approveLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }

    const recipients = await this.notificationRecipientRepository.find({
      where: { requestId: leaveRequest.id },
      relations: ['user'],
    });

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

    // Load recipients BEFORE transaction
    const rejectRecipients = await this.notificationRecipientRepository.find({
      where: { requestId: leaveRequest.id },
      relations: ['user'],
    });

    // ── Transaction: reject + release reserves ───────────────
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let updated: LeaveRequest;
    try {
      leaveRequest.status = LeaveRequestStatus.REJECTED;
      leaveRequest.rejectedAt = new Date();
      leaveRequest.rejectedReason = rejectedReason;
      updated = await queryRunner.manager.save(leaveRequest);

      // Release the RESERVE debits → CREDIT RELEASE
      await this.leaveBalanceService.releaseReserveForRejection(
        leaveRequest.userId,
        leaveRequest.id,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[rejectLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }

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

    this.logger.log(`Leave request ${requestId} rejected by user ${approverId} (reserves released)`);
    return updated;
  }

  /**
   * Cancel leave request (by requester)
   * Supports cancelling PENDING or APPROVED requests.
   * If APPROVED, refunds the balance.
   */
  async cancelLeaveRequest(requestId: number, userId: number): Promise<LeaveRequest> {
    const leaveRequest = await this.leaveRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user', 'items'],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (![LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED].includes(leaveRequest.status)) {
      throw new BadRequestException(`Cannot cancel request with status: ${leaveRequest.status}`);
    }

    const wasApproved = leaveRequest.status === LeaveRequestStatus.APPROVED;

    // Load recipients BEFORE transaction deletes them
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
      await queryRunner.manager.save(leaveRequest);
      await queryRunner.manager.delete(LeaveRequestNotificationRecipient, { requestId: leaveRequest.id });

      if (wasApproved) {
        // After approve → CREDIT REFUND (reverses APPROVAL debits)
        const year = new Date(leaveRequest.startDate).getFullYear();
        await this.leaveBalanceService.refundBalanceForCancellation(
          leaveRequest.userId,
          leaveRequest.id,
          leaveRequest.items || [],
          year,
          queryRunner.manager,
        );
      } else {
        // Before approve (PENDING) → CREDIT RELEASE (reverses RESERVE debits)
        await this.leaveBalanceService.releaseReserveForRejection(
          leaveRequest.userId,
          leaveRequest.id,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[cancelLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`, error.stack);
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

    this.logger.log(`Leave request ${requestId} cancelled by user ${userId}${wasApproved ? ' (balance refunded)' : ' (reserves released)'}`);
    return leaveRequest;
  }

  /**
   * Get all active, non-system leave types grouped by category.
   * For categories with intra-category auto-conversion (e.g. ANNUAL: Paid→Unpaid),
   * conversion-target types are hidden and `autoConvert` is set to true.
   */
  async getLeaveTypes() {
    const categories = await this.leaveCategoryRepository.find({
      where: { isActive: true },
      relations: ['leaveTypes'],
      order: { id: 'ASC' },
    });

    // Find leave-type ids that are intra-category EXCEED_BALANCE conversion targets
    // These are auto-managed by the balance service and should not be user-selectable.
    const autoTargetRows: { id: string }[] = await this.dataSource
      .createQueryBuilder()
      .select('DISTINCT ltc.to_leave_type_id', 'id')
      .from('leave_type_conversions', 'ltc')
      .innerJoin('leave_types', 'from_lt', 'ltc.from_leave_type_id = from_lt.id')
      .innerJoin('leave_types', 'to_lt', 'ltc.to_leave_type_id = to_lt.id')
      .where('ltc.is_active = true')
      .andWhere('ltc.reason = :reason', { reason: 'EXCEED_BALANCE' })
      .andWhere('from_lt.category_id = to_lt.category_id')
      .getRawMany();

    const autoTargetIds = new Set(autoTargetRows.map((r) => Number(r.id)));

    return categories.map((cat) => {
      const allTypes = (cat.leaveTypes || []).filter((lt) => lt.isActive && !lt.isSystem);
      const hasAutoConvert = allTypes.some((lt) => autoTargetIds.has(Number(lt.id)));
      const visibleTypes = hasAutoConvert
        ? allTypes.filter((lt) => !autoTargetIds.has(Number(lt.id)))
        : allTypes;

      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        autoConvert: hasAutoConvert,
        leaveTypes: visibleTypes.map((lt) => ({
          id: lt.id,
          code: lt.code,
          name: lt.name,
          requiresDocument: lt.requiresDocument,
          requiresCompWorkingDate: lt.requiresCompWorkingDate,
        })),
      };
    });
  }

  /**
   * Find all leave requests for a user
   */
  async findUserLeaveRequests(userId: number): Promise<LeaveRequest[]> {
    this.logger.log(`[findUserLeaveRequests] Called for userId: ${userId}`);
    try {
      const results = await this.leaveRequestRepository.find({
        where: { userId },
        relations: ['approver', 'notificationRecipients', 'items', 'items.leaveType', 'requestedLeaveType', 'requestedLeaveType.category'],
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
  async findRequestsForManagement(user: { id: number; role: UserRole }): Promise<LeaveRequest[]> {
    this.logger.log(
      `[findRequestsForManagement] Called for userId: ${user.id}, role: ${user.role}`,
    );
    try {
      let results: LeaveRequest[];

      if (user.role === 'hr') {
        // HR can see all requests regardless of status
        this.logger.log(`[findRequestsForManagement] User is HR, fetching all requests`);
        results = await this.leaveRequestRepository.find({
          relations: ['user', 'approver', 'items', 'items.leaveType', 'requestedLeaveType', 'requestedLeaveType.category'],
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
          relations: ['user', 'approver', 'items', 'items.leaveType', 'requestedLeaveType', 'requestedLeaveType.category'],
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
   * Find one leave request by ID.
   * Returns a flat DTO with only the fields the frontend needs —
   * no raw entity spread, no sensitive data, optimised relations.
   */
  async findOne(id: number): Promise<LeaveRequestDetailsDto> {
    const lr = await this.leaveRequestRepository.findOne({
      where: { id },
      relations: [
        'user',
        'user.department',
        'approver',
        'approver.department',
        'notificationRecipients',
        'notificationRecipients.user',
        'items',
        'items.leaveType',
        'requestedLeaveType',
        'requestedLeaveType.category',
      ],
    });

    if (!lr) {
      throw new NotFoundException('Leave request not found');
    }

    // ── Map to DTO ───────────────────────────────────────────
    const ccRecipients = (lr.notificationRecipients ?? [])
      .filter((r) => r.type === RecipientType.CC && r.user)
      .map((r) => ({ id: r.user.id, username: r.user.username, email: r.user.email }));

    const dto: LeaveRequestDetailsDto = {
      id: lr.id,
      status: lr.status,
      version: lr.version,

      // People
      userId: lr.userId,
      requester: {
        id: lr.user.id,
        employeeId: lr.user.employeeId,
        username: lr.user.username,
        email: lr.user.email,
        department: lr.user.department?.name ?? null,
      },
      approverId: lr.approverId,
      approver: {
        id: lr.approver.id,
        employeeId: lr.approver.employeeId,
        username: lr.approver.username,
        email: lr.approver.email,
        department: lr.approver.department?.name ?? null,
      },

      // Leave type
      requestedLeaveType: lr.requestedLeaveType
        ? {
            id: lr.requestedLeaveType.id,
            code: lr.requestedLeaveType.code,
            name: lr.requestedLeaveType.name,
            category: lr.requestedLeaveType.category
              ? {
                  id: lr.requestedLeaveType.category.id,
                  code: lr.requestedLeaveType.category.code,
                  name: lr.requestedLeaveType.category.name,
                }
              : null,
          }
        : null,

      // Date & session
      startDate: lr.startDate,
      endDate: lr.endDate,
      startSession: lr.startSession,
      endSession: lr.endSession,
      durationDays: lr.durationDays,

      // Parental leave
      numberOfChildren: lr.numberOfChildren,
      childbirthMethod: lr.childbirthMethod,

      // Content
      reason: lr.reason,
      workSolution: lr.workSolution ?? null,

      // Items breakdown
      items: (lr.items ?? []).map((item) => ({
        leaveTypeId: Number(item.leaveTypeId),
        leaveTypeName: item.leaveType?.name ?? 'Unknown',
        leaveTypeCode: item.leaveType?.code ?? '',
        amountDays: Number(item.amountDays),
        periodYear: item.periodYear,
        periodMonth: item.periodMonth,
        note: item.note,
      })),

      // CC
      ccUserIds: ccRecipients.map((r) => r.id),
      ccRecipients,

      // Status workflow
      rejectedReason: lr.rejectedReason ?? null,
      rejectedAt: lr.rejectedAt ?? null,
      approvedAt: lr.approvedAt ?? null,
      cancelledAt: lr.cancelledAt ?? null,

      // Timestamps
      createdAt: lr.createdAt,
      updatedAt: lr.updatedAt,
    };

    return dto;
  }
}
