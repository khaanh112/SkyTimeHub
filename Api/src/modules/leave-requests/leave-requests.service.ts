import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LeaveRequest } from '@entities/leave_request.entity';
import { LeaveRequestNotificationRecipient } from '@entities/leave-request-notification-recipient.entity';
import { LeaveRequestItem } from '@entities/leave-request-item.entity';
import { LeaveType } from '@entities/leave-type.entity';
import { LeaveCategory } from '@entities/leave-category.entity';
import { UserApprover } from '@entities/user_approver.entity';
import { User } from '@entities/users.entity';
import { LeaveRequestAttachment } from '@entities/leave-request-attachment.entity';
import { StorageService } from '@modules/storage/storage.service';
import { LeaveRequestStatus } from '@common/enums/request_status';
import { RecipientType } from '@common/enums/recipient-type.enum';
import { UserRole } from '@/common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { LeaveBalanceService, LeaveValidationResult } from './leave-balance.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveRequestDetailsDto } from './dto/leave-request-details.dto';
import {
  LeaveRequestListItemDto,
  LeaveRequestListResponseDto,
  LeaveRequestPermissionsDto,
} from './dto/leave-request-list.dto';
import { ListLeaveRequestsQueryDto, LeaveRequestView } from './dto/list-leave-requests-query.dto';
import { AppException, ErrorCode } from '@/common';
import { Department } from '@entities/departments.entity';
import { buildDateTime, buildDurationLabel } from './utils/formatter';
import { validateAllocationsNoDuplicateBucket } from './utils/allocation-validator';
import { DefaultLeaveType } from '@/common/enums/default-leavetype.enum';
import { ContractType } from '@/common/enums/contract-type.enum';
import { LeaveCategory as LeaveCategoryEnum } from '@/common/enums/leave-category.enum';
import { vnTodayStr, toVN, dayjs } from '@/common/utils/date.util';

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
    @InjectRepository(LeaveRequestAttachment)
    private attachmentRepository: Repository<LeaveRequestAttachment>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private leaveBalanceService: LeaveBalanceService,
    private storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  /**
   * Compute half-day slot index from date + session.
   * Matches the DB trigger: (date - '2000-01-01') * 2 + (PM ? 1 : 0)
   */
  private dateToSlot(date: string, session: string): number {
    const daysDiff = dayjs(date).diff(dayjs('2000-01-01'), 'day');
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
      const fmt = (d: string) => d.split('-').reverse().join('/');
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `This leave request overlaps with an existing ${conflict.status} request (${fmt(conflict.startDate)} – ${fmt(conflict.endDate)}). Please choose different dates.`,
        409,
      );
    }
  }

  /**
   * Upload a PDF attachment to MinIO and create an orphan attachment record.
   * The attachment will be linked to the leave request upon creation.
   */
  async uploadAttachment(
    uploadedBy: number,
    file: Express.Multer.File,
  ): Promise<{ attachmentId: number; originalFilename: string; sizeBytes: number }> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size must not exceed 10 MB');
    }

    const { objectKey, bucket } = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    const attachment = this.attachmentRepository.create({
      leaveRequestId: null,
      originalFilename: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
      storageProvider: 'MINIO',
      bucket,
      objectKey,
      uploadedBy,
    });

    const saved = await this.attachmentRepository.save(attachment);

    return {
      attachmentId: saved.id,
      originalFilename: file.originalname,
      sizeBytes: file.size,
    };
  }

  /**
   * Return a short-lived presigned URL for downloading/viewing an attachment.
   * Access is granted to admins/HR, the uploader, the leave request owner, or the owner's configured approver.
   */
  async getAttachmentUrl(
    attachmentId: number,
    requesterId: number,
    requesterRole: UserRole,
  ): Promise<{ url: string; originalFilename: string | null }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Admins and HR can access all attachments
    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.HR) {
      // Access check: uploader OR owner of the linked leave request OR configured approver
      if (attachment.uploadedBy !== requesterId) {
        if (attachment.leaveRequestId) {
          const lr = await this.leaveRequestRepository.findOne({
            where: { id: attachment.leaveRequestId },
          });
          if (!lr || lr.userId !== requesterId) {
            const isApprover = lr
              ? await this.userApproverRepository.findOne({
                  where: { userId: lr.userId, approverId: requesterId, active: true },
                })
              : null;
            if (!isApprover) {
              throw new ForbiddenException('Access denied');
            }
          }
        } else {
          throw new ForbiddenException('Access denied');
        }
      }
    }

    const url = await this.storageService.getPresignedUrl(attachment.objectKey, 3600);
    return { url, originalFilename: attachment.originalFilename };
  }

  /**
   * Create a new leave request
   */
  async createLeaveRequest(userId: number, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    this.logger.log(
      `[createLeaveRequest] User ${userId} creating leave request: ${JSON.stringify(dto)}`,
    );

    //  Basic validation
    if (dto.endDate < dto.startDate) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'End date must be after start date', 400);
    }

    //  Approver lookup
    const userApprover = await this.userApproverRepository.findOne({
      where: { userId, active: true },
      relations: ['approver'],
    });

    if (!userApprover) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'No active approver assigned to this user',
        400,
      );
    }

    const requester = await this.userRepository.findOne({ where: { id: userId } });

    if (!requester) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found. Please contact HR to create an account.',
        HttpStatus.NOT_FOUND,
      );
    }
    const leaveTypeId = dto.leaveTypeId ?? DefaultLeaveType.PAID_LEAVE;

    // ── Official Employee eligibility check ──
    const requestedLeaveType = await this.leaveTypeRepository.findOne({
      where: { id: leaveTypeId },
      relations: ['category'],
    });
    if (!requestedLeaveType) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Leave type not found or inactive', 400);
    }
    const categoryCode = requestedLeaveType.category?.code;
    const officialOnlyCategories = [LeaveCategoryEnum.COMPENSATORY, LeaveCategoryEnum.SOCIAL];
    if (
      officialOnlyCategories.includes(categoryCode as LeaveCategoryEnum) &&
      requester.contractType !== ContractType.OFFICIAL
    ) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `${requestedLeaveType.name} is only available for official employees.`,
        400,
      );
    }

    // CC validation
    if (dto.ccUserIds?.includes(userId)) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'You cannot CC yourself on your own leave request',
        400,
      );
    }
    if (dto.ccUserIds?.includes(userApprover.approverId)) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Approver is automatically notified and should not be in CC list',
        400,
      );
    }
    if (dto.ccUserIds && dto.ccUserIds?.length > 0) {
      const hrUsers = await this.userRepository.find({
        where: { role: UserRole.HR, status: UserStatus.ACTIVE },
      });
      const hrUserIds = hrUsers.map((hr) => hr.id);
      if (dto.ccUserIds.some((id) => hrUserIds.includes(id))) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          'HR users are automatically notified and should not be in CC list',
          400,
        );
      }
    }

    // ── Overlap check
    await this.checkOverlap(userId, dto.startDate, dto.startSession, dto.endDate, dto.endSession);

    // Logic complex, too big function, double call validateandprepare, n+1 problem, race condition?, missmatch leave items and balance: không lưu unpaid leave balance

    // Preview warning and real saved data can be different, need checking version before submit
    // ── Pre-flight validation (outside transaction, for warnings) ─
    const preValidation = await this.leaveBalanceService.validateAndPrepare(
      userId,
      leaveTypeId,
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
        JSON.stringify({
          requiresConfirmation: true,
          warnings: preValidation.warnings,
          durationDays: preValidation.durationDays,
          items: preValidation.items,
        }),
        400,
      );
    }

    // ── Transaction (advisory lock + reserve) ────────────────
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedRequest: LeaveRequest;
    let validation: LeaveValidationResult;
    let emailIds: number[] = [];

    try {
      // Create leave request first to get ID for source_id in transactions
      const leaveRequest = this.leaveRequestRepository.create({
        userId,
        approverId: userApprover.approverId,
        requestedLeaveTypeId: leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        startSession: dto.startSession,
        endSession: dto.endSession,
        durationDays: preValidation.durationDays,
        reason: dto.reason,
        workSolution: dto.workSolution,
        numberOfChildren: dto.numberOfChildren ?? null,
        childbirthMethod: dto.childbirthMethod ?? null,
        status: LeaveRequestStatus.PENDING,
      });

      savedRequest = await queryRunner.manager.save(leaveRequest);

      // Reserve balance under advisory lock (re-validates inside tx)
      validation = await this.leaveBalanceService.reserveBalanceForSubmit(
        queryRunner.manager,
        userId,
        savedRequest.id,
        leaveTypeId,
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
      // P1-5: guard against duplicate (leaveTypeId, year, month) before save
      const allocationsToSave =
        validation.monthlyAllocations.length > 0
          ? validation.monthlyAllocations
          : validation.items.map((item) => ({
              ...item,
              year: toVN(dto.startDate).year(),
              month: toVN(dto.startDate).month() + 1,
            }));
      validateAllocationsNoDuplicateBucket(allocationsToSave);

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
        const requestYear = toVN(dto.startDate).year();
        const requestMonth = toVN(dto.startDate).month() + 1;
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

      if (recipients.length > 0) {
        await queryRunner.manager.save(recipients);
      }

      // Enqueue email notification INSIDE the transaction (transactional outbox)
      emailIds = await this.notificationsService.enqueueLeaveRequestCreatedNotification(
        savedRequest.id,
        userApprover.approverId,
        recipients,
        {
          requesterName: requester.username,
          approverName: userApprover.approver.username,
          startDate: savedRequest.startDate,
          endDate: savedRequest.endDate,
          leaveRequestId: savedRequest.id,
          dashboardLink: `${this.getFrontendUrl()}/leave-requests/${savedRequest.id}`,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Failed to create leave request: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Post-commit: trigger immediate send (fire and forget)
    this.notificationsService.triggerImmediateSend(emailIds);

    // Link orphan attachment to the newly created leave request
    if (dto.attachmentId) {
      await this.attachmentRepository.update(
        { id: dto.attachmentId, uploadedBy: userId },
        { leaveRequestId: savedRequest.id },
      );
    }

    // Post-commit: reload with all required relations (outside transaction scope)
    const reloadedRequest = await this.leaveRequestRepository.findOne({
      where: { id: savedRequest.id },
      relations: ['items', 'items.leaveType', 'user', 'approver', 'notificationRecipients'],
    });

    return reloadedRequest || savedRequest;
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
    if (dto.endDate < dto.startDate) {
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
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'You cannot CC yourself on your own leave request',
        400,
      );
    }
    if (dto.ccUserIds?.includes(leaveRequest.approverId)) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Approver is automatically notified and should not be in CC list',
        400,
      );
    }
    if (dto.ccUserIds && dto.ccUserIds?.length > 0) {
      const hrUsers = await this.userRepository.find({
        where: { role: UserRole.HR, status: UserStatus.ACTIVE },
      });
      const hrUserIds = hrUsers.map((hr) => hr.id);
      if (dto.ccUserIds.some((id) => hrUserIds.includes(id))) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          'HR users are automatically notified and should not be in CC list',
          400,
        );
      }
    }

    const leaveTypeId = dto.leaveTypeId ?? DefaultLeaveType.PAID_LEAVE;

    // ── Official Employee eligibility check ──
    const requestedLeaveTypeUpdate = await this.leaveTypeRepository.findOne({
      where: { id: leaveTypeId },
      relations: ['category'],
    });
    if (!requestedLeaveTypeUpdate) {
      throw new AppException(ErrorCode.INVALID_INPUT, 'Leave type not found or inactive', 400);
    }
    const updateCategoryCode = requestedLeaveTypeUpdate.category?.code;
    const officialOnlyCats = [LeaveCategoryEnum.COMPENSATORY, LeaveCategoryEnum.SOCIAL];
    if (
      officialOnlyCats.includes(updateCategoryCode as LeaveCategoryEnum) &&
      leaveRequest.user?.contractType !== ContractType.OFFICIAL
    ) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        `${requestedLeaveTypeUpdate.name} is only available for official employees.`,
        400,
      );
    }

    // ── Overlap check (exclude current request) ─────────────
    await this.checkOverlap(
      userId,
      dto.startDate,
      dto.startSession,
      dto.endDate,
      dto.endSession,
      requestId,
    );

    // ── Pre-flight validation (outside transaction, for warnings) ─
    const preValidation = await this.leaveBalanceService.validateAndPrepare(
      userId,
      leaveTypeId,
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
        JSON.stringify({
          requiresConfirmation: true,
          warnings: preValidation.warnings,
          durationDays: preValidation.durationDays,
          items: preValidation.items,
        }),
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
    let emailIds: number[] = [];

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

      // If old request was COMPENSATORY: release its RESERVE in comp_balance_transactions
      if (leaveRequest.requestedLeaveTypeId) {
        const oldLeaveType = await queryRunner.manager.findOne(LeaveType, {
          where: { id: leaveRequest.requestedLeaveTypeId },
          relations: ['category'],
        });
        if (oldLeaveType?.category?.code === LeaveCategoryEnum.COMPENSATORY) {
          await this.leaveBalanceService.writeCompLeaveReleaseCredit(
            queryRunner.manager,
            userId,
            requestId,
          );
        }
      }

      const originalVersion = leaveRequest.version;

      // Update fields
      leaveRequest.requestedLeaveTypeId = leaveTypeId;
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
        leaveTypeId,
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
        const requestYear = toVN(dto.startDate).year();
        const requestMonth = toVN(dto.startDate).month() + 1;
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

        if (dto.ccUserIds && dto.ccUserIds.length > 0) {
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

      // Load notification recipients inside transaction (may have just been updated)
      const txRecipients = await recipientRepo.find({
        where: { requestId },
        relations: ['user'],
      });

      // Enqueue email notification INSIDE the transaction (transactional outbox)
      emailIds = await this.notificationsService.enqueueLeaveRequestUpdatedNotification(
        requestId,
        leaveRequest.approverId,
        txRecipients,
        {
          requesterName: leaveRequest.user.username,
          startDate: dto.startDate,
          endDate: dto.endDate,
          dashboardLink: `${this.getFrontendUrl()}/leave-requests/${requestId}`,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[updateLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Post-commit: trigger immediate send (fire and forget)
    this.notificationsService.triggerImmediateSend(emailIds);

    // Reload with full relations
    const updatedRequest = await this.leaveRequestRepository.findOneOrFail({
      where: { id: requestId },
      relations: [
        'user',
        'notificationRecipients',
        'notificationRecipients.user',
        'items',
        'items.leaveType',
      ],
    });

    this.logger.log(
      `[updateLeaveRequest] Successfully updated request ${requestId} — version: ${updatedEntity.version}`,
    );
    return updatedRequest;
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
    let emailIds: number[] = [];
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

      // If COMPENSATORY, debit comp_balance_transactions
      if (leaveRequest.requestedLeaveTypeId) {
        const reqLeaveType = await queryRunner.manager.findOne(LeaveType, {
          where: { id: leaveRequest.requestedLeaveTypeId },
          relations: ['category'],
        });
        if (reqLeaveType?.category?.code === LeaveCategoryEnum.COMPENSATORY) {
          const totalDays = (leaveRequest.items || []).reduce(
            (sum, item) => sum + Number(item.amountDays),
            0,
          );
          await this.leaveBalanceService.writeCompLeaveApprovalDebit(
            queryRunner.manager,
            leaveRequest.userId,
            leaveRequest.id,
            totalDays,
          );
        }
      }

      // Load recipients and enqueue email INSIDE the transaction (transactional outbox)
      const recipients = await queryRunner.manager
        .getRepository(LeaveRequestNotificationRecipient)
        .find({
          where: { requestId: leaveRequest.id },
          relations: ['user'],
        });

      emailIds = await this.notificationsService.enqueueLeaveRequestApprovedNotification(
        leaveRequest.id,
        leaveRequest.userId,
        recipients,
        {
          requesterName: leaveRequest.user.username,
          approverName: leaveRequest.approver.username,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          approvedAt: leaveRequest.approvedAt.toISOString(),
          dashboardLink: `${this.getFrontendUrl()}/leave-requests/${leaveRequest.id}`,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[approveLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Post-commit: trigger immediate send (fire and forget)
    this.notificationsService.triggerImmediateSend(emailIds);

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
    let emailIds: number[] = [];
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

      // If COMPENSATORY: also release the RESERVE in comp_balance_transactions
      if (leaveRequest.requestedLeaveTypeId) {
        const reqLeaveType = await queryRunner.manager.findOne(LeaveType, {
          where: { id: leaveRequest.requestedLeaveTypeId },
          relations: ['category'],
        });
        if (reqLeaveType?.category?.code === LeaveCategoryEnum.COMPENSATORY) {
          await this.leaveBalanceService.writeCompLeaveReleaseCredit(
            queryRunner.manager,
            leaveRequest.userId,
            leaveRequest.id,
          );
        }
      }

      // Enqueue email notification INSIDE the transaction (transactional outbox)
      emailIds = await this.notificationsService.enqueueLeaveRequestRejectedNotification(
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
          dashboardLink: `${this.getFrontendUrl()}/leave-requests/${leaveRequest.id}`,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[rejectLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Post-commit: trigger immediate send (fire and forget)
    this.notificationsService.triggerImmediateSend(emailIds);

    this.logger.log(
      `Leave request ${requestId} rejected by user ${approverId} (reserves released)`,
    );
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
    let emailIds: number[] = [];
    try {
      leaveRequest.status = LeaveRequestStatus.CANCELLED;
      leaveRequest.cancelledAt = new Date();
      await queryRunner.manager.save(leaveRequest);
      await queryRunner.manager.delete(LeaveRequestNotificationRecipient, {
        requestId: leaveRequest.id,
      });

      if (wasApproved) {
        // After approve → CREDIT REFUND (reverses APPROVAL debits)

        await this.leaveBalanceService.refundBalanceForCancellation(
          leaveRequest.userId,
          leaveRequest.id,
          leaveRequest.items || [],
          queryRunner.manager,
        );

        // If COMPENSATORY, refund comp_balance_transactions
        if (leaveRequest.requestedLeaveTypeId) {
          const reqLeaveType = await queryRunner.manager.findOne(LeaveType, {
            where: { id: leaveRequest.requestedLeaveTypeId },
            relations: ['category'],
          });
          if (reqLeaveType?.category?.code === LeaveCategoryEnum.COMPENSATORY) {
            const totalDays = (leaveRequest.items || []).reduce(
              (sum, item) => sum + Number(item.amountDays),
              0,
            );
            await this.leaveBalanceService.writeCompLeaveRefundCredit(
              queryRunner.manager,
              leaveRequest.userId,
              leaveRequest.id,
              totalDays,
            );
          }
        }
      } else {
        // Before approve (PENDING) → CREDIT RELEASE (reverses RESERVE debits)
        await this.leaveBalanceService.releaseReserveForRejection(
          leaveRequest.userId,
          leaveRequest.id,
          queryRunner.manager,
        );

        // If COMPENSATORY: also release the RESERVE in comp_balance_transactions
        if (leaveRequest.requestedLeaveTypeId) {
          const reqLeaveType = await queryRunner.manager.findOne(LeaveType, {
            where: { id: leaveRequest.requestedLeaveTypeId },
            relations: ['category'],
          });
          if (reqLeaveType?.category?.code === LeaveCategoryEnum.COMPENSATORY) {
            await this.leaveBalanceService.writeCompLeaveReleaseCredit(
              queryRunner.manager,
              leaveRequest.userId,
              leaveRequest.id,
            );
          }
        }
      }

      // Enqueue email notification INSIDE the transaction (transactional outbox)
      // Uses pre-loaded cancelRecipients since notification_recipients were deleted above
      emailIds = await this.notificationsService.enqueueLeaveRequestCancelledNotification(
        leaveRequest.id,
        leaveRequest.approverId,
        cancelRecipients,
        {
          requesterName: leaveRequest.user.username,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          cancelledAt: leaveRequest.cancelledAt.toISOString(),
          dashboardLink: `${this.getFrontendUrl()}/leave-requests/${leaveRequest.id}`,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[cancelLeaveRequest] Transaction failed for request ${requestId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Post-commit: trigger immediate send (fire and forget)
    this.notificationsService.triggerImmediateSend(emailIds);

    this.logger.log(
      `Leave request ${requestId} cancelled by user ${userId}${wasApproved ? ' (balance refunded)' : ' (reserves released)'}`,
    );
    return leaveRequest;
  }

  /**
   * Get all active, non-system leave types grouped by category.
   * For categories with intra-category auto-conversion (e.g. ANNUAL: Paid→Unpaid),
   * conversion-target types are hidden and `autoConvert` is set to true.
   *
   * Filters by user contract type:
   *  - Official employees see all categories
   *  - Non-official (intern/probation) only see POLICY category
   */
  async getLeaveTypes(userId?: number) {
    // Determine if user is official
    let isOfficialEmployee = true; // default for backward compat
    if (userId) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'contractType'],
      });
      isOfficialEmployee = user?.contractType === ContractType.OFFICIAL;
    }

    const officialOnlyCategories = ['COMPENSATORY', 'SOCIAL'];

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

    // Filter categories based on contract type eligibility
    const eligibleCategories = isOfficialEmployee
      ? categories
      : categories.filter((cat) => !officialOnlyCategories.includes(cat.code));

    return eligibleCategories.map((cat) => {
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
          requiresCompWorkingDate:
            cat.code === LeaveCategoryEnum.COMPENSATORY ? false : lt.requiresCompWorkingDate,
        })),
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  LIST (paginated, filtered, personal / management view)
  // ═══════════════════════════════════════════════════════════

  /**
   * Unified list endpoint for both personal and management views.
   * Returns a paginated, filtered, searchable list of leave requests
   * with per-row permission flags.
   */
  async findLeaveRequests(
    currentUser: { id: number; role: UserRole },
    query: ListLeaveRequestsQueryDto,
  ): Promise<LeaveRequestListResponseDto> {
    this.logger.log(
      `[findLeaveRequests] START userId=${currentUser.id} role=${currentUser.role} query=${JSON.stringify(query)}`,
    );
    try {
      const {
        view = LeaveRequestView.PERSONAL,
        page = 1,
        pageSize = 10,
        status,
        leaveType,
        from,
        to,
        q,
        sort = '-startTime',
      } = query;

      // ── Authorization ──────────────────────────────────────────
      if (view === LeaveRequestView.MANAGEMENT) {
        const allowed = await this.canAccessManagementView(currentUser);
        if (!allowed) {
          throw new AppException(
            ErrorCode.FORBIDDEN,
            'You do not have access to the management view',
            403,
          );
        }
      }

      // ── QueryBuilder ───────────────────────────────────────────
      const qb = this.leaveRequestRepository
        .createQueryBuilder('lr')
        .leftJoinAndSelect('lr.items', 'item')
        .leftJoinAndSelect('item.leaveType', 'itemType')
        .leftJoinAndSelect('lr.approver', 'approver')
        .leftJoinAndSelect('lr.user', 'employee');

      // ── View scoping ───────────────────────────────────────────
      if (view === LeaveRequestView.PERSONAL) {
        qb.andWhere('lr.user_id = :userId', { userId: currentUser.id });
      } else {
        // management view
        if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.HR) {
          // Department leader / approver: only their assigned requests
          qb.andWhere('lr.approver_id = :approverId', {
            approverId: currentUser.id,
          });
        }
        // Admin / HR: no extra filter → see all
      }

      // ── Status filter ──────────────────────────────────────────
      if (status?.length) {
        qb.andWhere('lr.status IN (:...statuses)', { statuses: status });
      }

      // ── Leave type filter (by items) ───────────────────────────
      if (leaveType?.length) {
        // Request must have at least one item whose leaveTypeId is in the list
        qb.andWhere(
          `lr.id IN (
          SELECT lri.leave_request_id
          FROM leave_request_items lri
          WHERE lri.leave_type_id IN (:...leaveTypeIds)
        )`,
          { leaveTypeIds: leaveType },
        );
      }

      // ── Date range filter ──────────────────────────────────────
      if (from) {
        qb.andWhere('lr.end_date >= :from', { from });
      }
      if (to) {
        qb.andWhere('lr.start_date <= :to', { to });
      }

      // ── Search ─────────────────────────────────────────────────
      if (q?.trim()) {
        const search = `%${q.trim()}%`;
        if (view === LeaveRequestView.MANAGEMENT) {
          // Search by code (ID), reason, or employee name
          qb.andWhere(
            `(
            CAST(lr.id AS TEXT) ILIKE :search
            OR lr.reason ILIKE :search
            OR employee.username ILIKE :search
          )`,
            { search },
          );
        } else {
          // Personal view: search by code (ID) or reason
          qb.andWhere(
            `(
            CAST(lr.id AS TEXT) ILIKE :search
            OR lr.reason ILIKE :search
          )`,
            { search },
          );
        }
      }

      // ── Sort ───────────────────────────────────────────────────
      // NOTE: QueryBuilder orderBy requires entity property names (camelCase),
      // NOT database column names (snake_case).
      const sortMapping: Record<string, string> = {
        startTime: 'lr.startDate',
        createdAt: 'lr.createdAt',
        status: 'lr.status',
        endTime: 'lr.endDate',
      };

      let sortField = 'lr.startDate';
      let sortOrder: 'ASC' | 'DESC' = 'DESC';

      if (sort) {
        const desc = sort.startsWith('-');
        const field = desc ? sort.slice(1) : sort;
        sortField = sortMapping[field] ?? 'lr.startDate';
        sortOrder = desc ? 'DESC' : 'ASC';
      }
      qb.orderBy(sortField, sortOrder);
      // Secondary sort by id for stable pagination
      qb.addOrderBy('lr.id', 'DESC');

      // ── Count total (before pagination) ────────────────────────
      const total = await qb.getCount();

      // ── Pagination ─────────────────────────────────────────────
      qb.skip((page - 1) * pageSize).take(pageSize);

      const leaveRequests = await qb.getMany();

      // ── Map to DTOs ────────────────────────────────────────────
      const isManagement = view === LeaveRequestView.MANAGEMENT;

      const data: LeaveRequestListItemDto[] = leaveRequests.map((lr) => {
        // Collect distinct leave type names from items
        const leaveTypeNames = [
          ...new Set(
            (lr.items ?? []).map((item) => item.leaveType?.name).filter(Boolean) as string[],
          ),
        ];

        // Build human-readable start/end time
        const startTime = buildDateTime(lr.startDate, lr.startSession, 'start');
        const endTime = buildDateTime(lr.endDate, lr.endSession, 'end');

        // Duration label
        const durationLabel = buildDurationLabel(lr.durationDays);

        // Permissions
        const permissions = this.computePermissions(lr);

        return {
          id: lr.id,
          code: `LV-${String(lr.id).padStart(3, '0')}`,
          leaveTypes: leaveTypeNames,
          startTime,
          endTime,
          durationLabel,
          approverName: lr.approver?.username ?? '',
          ...(isManagement ? { employeeName: lr.user?.username ?? '' } : {}),
          status: lr.status,
          rejectedReason: lr.rejectedReason ?? null,
          version: lr.version,
          permissions,
        };
      });

      const response = {
        success: true as const,
        data,
        page: { page, pageSize, total },
      };
      this.logger.log(`[findLeaveRequests] OK – returned ${data.length} items, total=${total}`);
      return response;
    } catch (error) {
      this.logger.error(
        `[findLeaveRequests] ERROR userId=${currentUser.id}`,
        error?.stack ?? error,
      );
      throw error;
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Check if the user is allowed to access management view.
   * Admin / HR: always.
   * Others: must be a department leader or active approver.
   */
  private async canAccessManagementView(user: { id: number; role: UserRole }): Promise<boolean> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.HR) {
      return true;
    }

    // Check if user is a department leader
    const isDeptLeader = await this.dataSource
      .getRepository(Department)
      .createQueryBuilder('d')
      .where('d.leader_id = :userId', { userId: user.id })
      .getCount();

    if (isDeptLeader > 0) return true;

    // Check if user is an active approver for anyone
    const isApprover = await this.userApproverRepository.count({
      where: { approverId: user.id, active: true },
    });

    return isApprover > 0;
  }

  /**
   * Compute per-row action permissions based on status and whether
   * the leave start date is in the future.
   */
  private computePermissions(lr: LeaveRequest): LeaveRequestPermissionsDto {
    const isFuture = lr.startDate > vnTodayStr();

    switch (lr.status) {
      case LeaveRequestStatus.PENDING:
        return {
          canViewDetail: true,
          canUpdate: isFuture,
          canCancel: isFuture,
        };
      case LeaveRequestStatus.APPROVED:
        return {
          canViewDetail: true,
          canUpdate: false,
          canCancel: isFuture,
        };
      case LeaveRequestStatus.REJECTED:
        return {
          canViewDetail: true,
          canUpdate: false,
          canCancel: false,
        };
      case LeaveRequestStatus.CANCELLED:
        return {
          canViewDetail: true,
          canUpdate: false,
          canCancel: false,
        };
      default:
        return {
          canViewDetail: true,
          canUpdate: false,
          canCancel: false,
        };
    }
  }

  /**
   * Find one leave request by ID.
   * Returns a flat DTO with only the fields the frontend needs —
   * no raw entity spread, no sensitive data, optimised relations.
   */
  async findOne(id: number): Promise<LeaveRequestDetailsDto> {
    this.logger.log(`[findOne] START id=${id}`);
    try {
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
          'attachments',
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

        // Attachment (Social benefits proof document)
        attachment: lr.attachments?.[0]
          ? {
              id: Number(lr.attachments[0].id),
              originalFilename: lr.attachments[0].originalFilename,
              sizeBytes: lr.attachments[0].sizeBytes ? Number(lr.attachments[0].sizeBytes) : null,
            }
          : null,
      };

      this.logger.log(`[findOne] OK – id=${id} status=${dto.status}`);
      return dto;
    } catch (error) {
      this.logger.error(`[findOne] ERROR id=${id}`, error?.stack ?? error);
      throw error;
    }
  }
}
