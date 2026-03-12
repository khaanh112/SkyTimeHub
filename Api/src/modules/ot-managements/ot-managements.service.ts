import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Brackets } from 'typeorm';
import { OtPlan } from '@/entities/ot-plan.entity';
import { OtPlanEmployee } from '@/entities/ot-plan-employee.entity';
import { OtCheckin } from '@/entities/ot-checkin.entity';
import { OtCheckinItem } from '@/entities/ot-checkin-item.entity';
import { OtType } from '@/entities/ot-type.entity';
import { OtBalanceTransaction } from '@/entities/ot-balance-transaction.entity';
import { CompBalanceTransaction } from '@/entities/comp-balance-transaction.entity';
import { LeaveRequest } from '@/entities/leave_request.entity';
import { User } from '@/entities/users.entity';
import { Department } from '@/entities/departments.entity';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { OtPlanStatus } from '@/common/enums/ot-plan-status.enum';
import { OtCheckinStatus } from '@/common/enums/ot-checkin-status.enum';
import { OtBalanceSource } from '@/common/enums/ot-balance-source.enum';
import { OtCompensatoryMethod } from '@/common/enums/ot-compensatory-method.enum';
import { CompTxDirection } from '@/common/enums/comp-tx-direction.enum';
import { CompTxSource } from '@/common/enums/comp-tx-source.enum';
import { LeaveRequestStatus } from '@/common/enums/request_status';
import { UserRole } from '@/common/enums/roles.enum';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { CreateOtPlanDto } from './dto/create-ot-plan.dto';
import { UpdateOtPlanDto } from './dto/update-ot-plan.dto';
import { ListOtPlansQueryDto, OtPlanView } from './dto/list-ot-plans-query.dto';
import { CheckinDto } from './dto/checkin.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { OtBalanceService } from './ot-balance.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { computeDurationMinutes } from './utils/duration-calculator';
import { splitIntoSegments, applyCarryOver } from './utils/segment-splitter';
import { formatOtPlanCode } from './utils/ot-plan-code-formatter';
import { AppException, ErrorCode } from '@/common';
import { OtBalanceDirection } from '@/common/enums/ot-balance-direction.enum';

@Injectable()
export class OtManagementsService {
  private readonly logger = new Logger(OtManagementsService.name);

  constructor(
    @InjectRepository(OtPlan)
    private readonly otPlanRepo: Repository<OtPlan>,
    @InjectRepository(OtPlanEmployee)
    private readonly otPlanEmpRepo: Repository<OtPlanEmployee>,
    @InjectRepository(OtCheckin)
    private readonly otCheckinRepo: Repository<OtCheckin>,
    @InjectRepository(OtCheckinItem)
    private readonly otCheckinItemRepo: Repository<OtCheckinItem>,
    @InjectRepository(OtType)
    private readonly otTypeRepo: Repository<OtType>,
    @InjectRepository(OtBalanceTransaction)
    private readonly otBalanceRepo: Repository<OtBalanceTransaction>,
    @InjectRepository(CompBalanceTransaction)
    private readonly compBalanceRepo: Repository<CompBalanceTransaction>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    @InjectRepository(CalendarOverride)
    private readonly calendarRepo: Repository<CalendarOverride>,
    private readonly dataSource: DataSource,
    private readonly otBalanceService: OtBalanceService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── CREATE ─────────────────────────────────────────────────
  async createOtPlan(userId: number, dto: CreateOtPlanDto) {
    this.logger.log(`[createOtPlan] userId=${userId}`);

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['department'],
    });
    if (!user || !user.departmentId) {
      throw new BadRequestException('User must belong to a department');
    }

    const dept = await this.deptRepo.findOne({ where: { id: user.departmentId } });
    if (!dept || dept.leaderId !== userId) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Only department leaders can create OT plans',
        403,
      );
    }

    // Auto-assign approver to admin user
    const approver = await this.userRepo.findOne({ where: { role: UserRole.ADMIN } });
    if (!approver) {
      throw new BadRequestException('No admin user found to assign as approver');
    }

    // Validate all employees belong to the leader's department
    const employeeIds = dto.employees.map((e) => e.employeeId);
    const empUsers = await this.userRepo.findBy({ id: In(employeeIds) });
    const outsideDept = empUsers.filter((e) => e.departmentId !== user.departmentId);
    if (outsideDept.length > 0) {
      throw new ForbiddenException(
        `Employees [${outsideDept.map((e) => e.id).join(', ')}] do not belong to your department`,
      );
    }

    // Validate employee start/end times
    for (const emp of dto.employees) {
      const start = new Date(emp.startTime);
      const end = new Date(emp.endTime);
      if (end <= start) {
        throw new BadRequestException(
          `End time must be after start time for employee ${emp.employeeId}`,
        );
      }
    }

    // ── CC-01: Self-overlap check within this DTO ────────────
    const grouped = new Map<number, { startTime: string; endTime: string; index: number }[]>();
    for (let i = 0; i < dto.employees.length; i++) {
      const e = dto.employees[i];
      const list = grouped.get(e.employeeId) ?? [];
      list.push({ startTime: e.startTime, endTime: e.endTime, index: i });
      grouped.set(e.employeeId, list);
    }
    for (const [empId, rows] of grouped.entries()) {
      for (let a = 0; a < rows.length; a++) {
        for (let b = a + 1; b < rows.length; b++) {
          const aStart = new Date(rows[a].startTime).getTime();
          const aEnd   = new Date(rows[a].endTime).getTime();
          const bStart = new Date(rows[b].startTime).getTime();
          const bEnd   = new Date(rows[b].endTime).getTime();
          if (aStart < bEnd && bStart < aEnd) {
            const empUser = empUsers.find((u) => u.id === empId);
            throw new AppException(
              ErrorCode.OT_OVERLAP,
              `The overtime periods for ${empUser?.username ?? `employee ${empId}`} overlap within this plan. Please adjust the start and end times.`,
              409,
            );
          }
        }
      }
    }

    // ── AC-02: Overlap with existing plans ──────────────────
    for (const empDto of dto.employees) {
      const overlappingPlan = await this.otPlanEmpRepo
        .createQueryBuilder('pe')
        .innerJoin('pe.otPlan', 'plan')
        .where('pe.employeeId = :empId', { empId: empDto.employeeId })
        .andWhere('plan.status IN (:...statuses)', { statuses: [OtPlanStatus.PENDING, OtPlanStatus.APPROVED] })
        .andWhere('pe.startTime < :end', { end: new Date(empDto.endTime) })
        .andWhere('pe.endTime > :start', { start: new Date(empDto.startTime) })
        .getOne();
      if (overlappingPlan) {
        const empUser = empUsers.find((u) => u.id === empDto.employeeId);
        throw new AppException(
          ErrorCode.OT_OVERLAP,
          `Submission failed: The overtime period for ${empUser?.username ?? `employee ${empDto.employeeId}`} overlaps with their scheduled leave or another existing OT plan.`,
          409,
        );
      }
    }

    // ── AC-02: Overlap with approved leave requests ─────────
    for (const empDto of dto.employees) {
      const otStart = new Date(empDto.startTime);
      const otEnd   = new Date(empDto.endTime);
      const otStartDate = otStart.toISOString().slice(0, 10);
      const otEndDate   = otEnd.toISOString().slice(0, 10);

      const overlappingLeave = await this.leaveRequestRepo
        .createQueryBuilder('lr')
        .where('lr.userId = :empId', { empId: empDto.employeeId })
        .andWhere('lr.status = :status', { status: LeaveRequestStatus.APPROVED})
        .andWhere('lr.startDate <= :otEnd', { otEnd: otEndDate })
        .andWhere('lr.endDate >= :otStart', { otStart: otStartDate })
        .getOne();
      if (overlappingLeave) {
        const empUser = empUsers.find((u) => u.id === empDto.employeeId);
        throw new AppException(
          ErrorCode.OT_OVERLAP,
          `Submission failed: The overtime period for ${empUser?.username ?? `employee ${empDto.employeeId}`} overlaps with their scheduled leave or another existing OT plan.`,
          409,
        );
      }
    }

    // ── AC-03: Soft balance warning (daily / monthly / yearly) ─
    if (!dto.acknowledgeBalanceExceeded) {
      for (const empDto of dto.employees) {
        const start = new Date(empDto.startTime);
        const newMinutes = computeDurationMinutes(start, new Date(empDto.endTime));
        const isHoliday = false; // plan-time check uses conservative non-holiday cap
        const result = await this.otBalanceService.validateOtLimits(
          empDto.employeeId,
          start,
          newMinutes,
          isHoliday,
        );
        if (!result.valid) {
          throw new AppException(
            ErrorCode.BALANCE_EXCEEDED,
            result.violations.join('; '),
            422,
          );
        }
      }
    }

    const submittedEmailIds: number[] = [];
    const savedPlanId = await this.dataSource.transaction(async (manager) => {
      // Create OT Plan
      const plan = manager.create(OtPlan, {
        title: dto.title,
        description: dto.description,
        departmentId: user.departmentId,
        createdBy: userId,
        approverId: approver.id,
        status: OtPlanStatus.PENDING,
        totalDurationMinutes: 0,
      } as Partial<OtPlan>);
      const savedPlan = await manager.save(OtPlan, plan);

      let totalMinutes = 0;

      for (const empDto of dto.employees) {
        const start = new Date(empDto.startTime);
        const end = new Date(empDto.endTime);
        const durationMinutes = computeDurationMinutes(start, end);

        const planEmp = manager.create(OtPlanEmployee, {
          otPlanId: savedPlan.id,
          employeeId: empDto.employeeId,
          startTime: start,
          endTime: end,
          durationMinutes,
          plannedTask: empDto.plannedTask,
        });
        const savedPlanEmp = await manager.save(OtPlanEmployee, planEmp);

        // ── Balance CREDIT: ghi ngay khi tạo plan ───────────
        await manager.save(OtBalanceTransaction, manager.create(OtBalanceTransaction, {
          employeeId: empDto.employeeId,
          direction: OtBalanceDirection.CREDIT,
          amountMinutes: durationMinutes,
          sourceType: OtBalanceSource.OT_PLAN_APPROVED,
          sourceId: Number(savedPlanEmp.id),
          periodYear: start.getFullYear(),
          periodMonth: start.getMonth() + 1,
          periodDate: start.toISOString().slice(0, 10),
          note: `OT plan submitted — plan employee #${savedPlanEmp.id}`,
        }));

        // Create pending checkin record
        const checkin = manager.create(OtCheckin, {
          otPlanEmployeeId: savedPlanEmp.id,
          status: OtCheckinStatus.PENDING,
        });
        await manager.save(OtCheckin, checkin);

        totalMinutes += durationMinutes;
      }
      const emailIds = await this.notificationsService.enqueueOtPlanSubmittedNotification(
        savedPlan.id,
        approver.id,
        {
          bodName: approver.username,
          leaderName: user.username,
          departmentName: dept.name,
          otPlanUrl: `${process.env.FRONTEND_URL}/ot-management/${savedPlan.id}`,
        },
        manager,
      );
      submittedEmailIds.push(...emailIds);

      return savedPlan.id;
    });

    // Post-commit: trigger immediate send (fire and forget)
    this.notificationsService.triggerImmediateSend(submittedEmailIds);

    return this.findOne(savedPlanId, userId);
  }

  // ─── FIND ALL (LIST) ────────────────────────────────────────
  async findOtPlans(user: { id: number; role: UserRole }, query: ListOtPlansQueryDto) {
    const { view, page = 1, pageSize = 10, status, from, to, q, sort, departmentId } = query;

    // Step 1: Build a sub-query to find matching plan IDs with filters
    const idQb = this.otPlanRepo.createQueryBuilder('plan').select('plan.id', 'id');

    // Determine if we need employee join
    const needsEmpJoin =
      view === OtPlanView.PERSONAL ||
      from ||
      to ||
      (user.role !== UserRole.ADMIN && user.role !== UserRole.HR);

    if (needsEmpJoin) {
      idQb.leftJoin('plan.employees', 'emp');
    }

    // Search needs department join
    if (q) {
      idQb.leftJoin('plan.department', 'dept');
    }

    // ── View filtering ──
    if (view === OtPlanView.PERSONAL) {
      idQb.andWhere(
        new Brackets((sub) => {
          sub
            .where('plan.createdBy = :userId', { userId: user.id })
            .orWhere('emp.employeeId = :userId', { userId: user.id });
        }),
      );
    } else {
      // Management view
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.HR) {
        const dept = await this.deptRepo.findOne({ where: { leaderId: user.id } });
        if (dept) {
          idQb.andWhere(
            new Brackets((sub) => {
              sub
                .where('plan.departmentId = :deptId', { deptId: dept.id })
                .orWhere('plan.approverId = :userId', { userId: user.id });
            }),
          );
        } else {
          // Regular employees only see assigned plans
          if (!needsEmpJoin) {
            idQb.leftJoin('plan.employees', 'emp');
          }
          idQb.andWhere('emp.employeeId = :userId', { userId: user.id });
        }
      } else if (departmentId) {
        // Admin/HR: optional department filter
        idQb.andWhere('plan.departmentId = :filterDeptId', { filterDeptId: departmentId });
      }
    }

    // ── Status filter ──
    if (status && status.length > 0) {
      idQb.andWhere('plan.status IN (:...status)', { status });
    }

    // ── Date range filter ──
    if (from) {
      idQb.andWhere('emp.startTime >= :from', { from: new Date(`${from}T00:00:00Z`) });
    }
    if (to) {
      idQb.andWhere('emp.startTime <= :to', { to: new Date(`${to}T23:59:59Z`) });
    }

    // ── Search ──
    if (q) {
      const search = `%${q.toLowerCase()}%`;
      idQb.andWhere(
        new Brackets((sub) => {
          sub
            .where('LOWER(plan.title) LIKE :search', { search })
            .orWhere('LOWER(dept.name) LIKE :search', { search });
        }),
      );
    }

    // GROUP BY to deduplicate plan IDs from joins
    idQb.groupBy('plan.id');

    // ── Get total count ──
    const allIds = await idQb.getRawMany();
    const totalCount = allIds.length;

    if (totalCount === 0) {
      return {
        success: true,
        data: [],
        page: { page, pageSize, total: 0 },
      };
    }

    // ── Sort ──
    const sortField = sort || '-createdAt';
    const direction: 'ASC' | 'DESC' = sortField.startsWith('-') ? 'DESC' : 'ASC';
    const field = sortField.replace(/^-/, '');
    const sortColumn = field === 'title' ? 'plan.title' : 'plan.createdAt';

    // ── Get paginated plan IDs ──
    idQb.orderBy(sortColumn, direction);
    idQb.offset((page - 1) * pageSize);
    idQb.limit(pageSize);

    const planIdRows = await idQb.getRawMany();
    const planIds = planIdRows.map((r) => Number(r.id));

    if (planIds.length === 0) {
      return {
        success: true,
        data: [],
        page: { page, pageSize, total: totalCount },
      };
    }

    // ── Load full plans ──
    const plans = await this.otPlanRepo.find({
      where: { id: In(planIds) },
      relations: ['department', 'employees', 'employees.checkins'],
      order: { [field === 'title' ? 'title' : 'createdAt']: direction },
    });

    const data = plans.map((plan) => {
      const empCount = plan.employees?.length || 0;
      const checkedInCount =
        plan.employees?.reduce((acc, emp) => {
          const hasCheckedIn = emp.checkins?.some(
            (c) =>
              c.status === OtCheckinStatus.CHECKED_IN ||
              c.status === OtCheckinStatus.CHECKED_OUT ||
              c.status === OtCheckinStatus.LEADER_APPROVED,
          );
          return acc + (hasCheckedIn ? 1 : 0);
        }, 0) || 0;

      const earliestStart = plan.employees?.reduce(
        (earliest, emp) => {
          const st = new Date(emp.startTime);
          return !earliest || st < earliest ? st : earliest;
        },
        null as Date | null,
      );

      const latestEnd = plan.employees?.reduce(
        (latest, emp) => {
          const et = new Date(emp.endTime);
          return !latest || et > latest ? et : latest;
        },
        null as Date | null,
      );

      let executionDate = '';
      if (earliestStart) {
        executionDate = earliestStart.toISOString().slice(0, 10);
        if (latestEnd && latestEnd.toDateString() !== earliestStart.toDateString()) {
          executionDate += ` - ${latestEnd.toISOString().slice(0, 10)}`;
        }
      }

      // Permissions
      const isCreator = plan.createdBy === user.id;
      const isApprover = plan.approverId === user.id;
      const canUpdate = isCreator && plan.status === OtPlanStatus.PENDING;
      // canCancel requires: creator, pending/approved status, AND no employee has checked in yet
      const canCancel =
        isCreator &&
        (plan.status === OtPlanStatus.PENDING || plan.status === OtPlanStatus.APPROVED) &&
        checkedInCount === 0;
      const canApprove = isApprover && plan.status === OtPlanStatus.PENDING;
      const canReject = isApprover && plan.status === OtPlanStatus.PENDING;

      return {
        id: plan.id,
        code: formatOtPlanCode(plan.id, plan.createdAt),
        title: plan.title,
        departmentName: plan.department?.name || '',
        executionDate,
        employeeCount: empCount,
        totalDurationMinutes: plan.totalDurationMinutes,
        status: plan.status,
        checkinInfo:
          plan.status === OtPlanStatus.APPROVED ? `${checkedInCount}/${empCount}` : undefined,
        rejectedReason: plan.rejectedReason,
        version: plan.version,
        permissions: {
          canUpdate,
          canCancel,
          canApprove,
          canReject,
          canViewCheckins: plan.status === OtPlanStatus.APPROVED,
        },
      };
    });

    return {
      success: true,
      data,
      page: { page, pageSize, total: totalCount },
    };
  }

  // ─── FIND ONE ───────────────────────────────────────────────
  async findOne(id: number, userId?: number) {
    const plan = await this.otPlanRepo.findOne({
      where: { id },
      relations: ['department', 'employees', 'employees.employee', 'employees.checkins'],
    });

    if (!plan) {
      throw new NotFoundException(`OT plan #${id} not found`);
    }

    const creator = await this.userRepo.findOne({ where: { id: plan.createdBy } });
    const approver = await this.userRepo.findOne({ where: { id: plan.approverId } });

    const isCreator = userId && plan.createdBy === userId;
    const isApprover = userId && plan.approverId === userId;

    const employees = plan.employees.map((emp) => {
      const latestCheckin =
        emp.checkins?.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] || null;

      return {
        id: emp.id,
        employeeId: emp.employeeId,
        employeeName: emp.employee?.username || '',
        employeeEmail: emp.employee?.email || '',
        startTime: emp.startTime,
        endTime: emp.endTime,
        durationMinutes: emp.durationMinutes,
        plannedTask: emp.plannedTask,
        checkin: latestCheckin
          ? {
              id: latestCheckin.id,
              status: latestCheckin.status,
              checkInAt: latestCheckin.checkInAt,
              checkOutAt: latestCheckin.checkOutAt,
              actualDurationMinutes: latestCheckin.actualDurationMinutes,
              workOutput: latestCheckin.workOutput,
              compensatoryMethod: latestCheckin.compensatoryMethod,
              rejectedReason: latestCheckin.rejectedReason,
              version: latestCheckin.version,
            }
          : null,
      };
    });

    return {
      id: plan.id,
      code: formatOtPlanCode(plan.id, plan.createdAt),
      title: plan.title,
      description: plan.description,
      departmentId: plan.departmentId,
      departmentName: plan.department?.name || '',
      createdBy: plan.createdBy,
      creatorName: creator?.username || '',
      approverId: plan.approverId,
      approverName: approver?.username || '',
      totalDurationMinutes: plan.totalDurationMinutes,
      status: plan.status,
      rejectedReason: plan.rejectedReason,
      version: plan.version,
      approvedAt: plan.approvedAt,
      rejectedAt: plan.rejectedAt,
      cancelledAt: plan.cancelledAt,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      employees,
      permissions: {
        canUpdate: isCreator && plan.status === OtPlanStatus.PENDING,
        canCancel:
          isCreator &&
          (plan.status === OtPlanStatus.PENDING || plan.status === OtPlanStatus.APPROVED) &&
          !plan.employees?.some((emp) =>
            emp.checkins?.some((c) => c.status !== OtCheckinStatus.PENDING),
          ),
        canApprove: isApprover && plan.status === OtPlanStatus.PENDING,
        canReject: isApprover && plan.status === OtPlanStatus.PENDING,
        canManageCheckins: isCreator && plan.status === OtPlanStatus.APPROVED,
      },
    };
  }

  // ─── UPDATE ─────────────────────────────────────────────────
  async updateOtPlan(id: number, userId: number, dto: UpdateOtPlanDto) {
    const plan = await this.otPlanRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`OT plan #${id} not found`);
    if (plan.createdBy !== userId)
      throw new ForbiddenException('Only the creator can update this plan');
    if (plan.status !== OtPlanStatus.PENDING)
      throw new BadRequestException('Only pending plans can be updated');
    if (plan.version !== dto.version)
      throw new ConflictException('Plan has been modified. Please refresh and try again.');

    await this.dataSource.transaction(async (manager) => {
      // Delete old employee rows (cascade deletes checkins too)
      await manager.delete(OtPlanEmployee, { otPlanId: id });

      // Auto-assign approver to admin user
      const approver = await this.userRepo.findOne({ where: { role: UserRole.ADMIN } });
      if (!approver) {
        throw new BadRequestException('No admin user found to assign as approver');
      }

      // Update plan fields
      plan.title = dto.title;
      plan.description = dto.description || null;
      plan.approverId = approver.id;

      let totalMinutes = 0;

      for (const empDto of dto.employees) {
        const start = new Date(empDto.startTime);
        const end = new Date(empDto.endTime);
        if (end <= start) {
          throw new BadRequestException(
            `End time must be after start time for employee ${empDto.employeeId}`,
          );
        }

        const durationMinutes = computeDurationMinutes(start, end);

        const planEmp = manager.create(OtPlanEmployee, {
          otPlanId: id,
          employeeId: empDto.employeeId,
          startTime: start,
          endTime: end,
          durationMinutes,
          plannedTask: empDto.plannedTask,
        });
        const savedPlanEmp = await manager.save(OtPlanEmployee, planEmp);

        // Create pending checkin record
        const checkin = manager.create(OtCheckin, {
          otPlanEmployeeId: savedPlanEmp.id,
          status: OtCheckinStatus.PENDING,
        });
        await manager.save(OtCheckin, checkin);

        totalMinutes += durationMinutes;
      }

      plan.totalDurationMinutes = totalMinutes;
      await manager.save(OtPlan, plan);
    });

    return this.findOne(id, userId);
  }

  // ─── APPROVE ────────────────────────────────────────────────
  async approveOtPlan(id: number, userId: number, version: number) {
    const plan = await this.otPlanRepo.findOne({
      where: { id },
      relations: ['employees'],
    });
    if (!plan) throw new NotFoundException(`OT plan #${id} not found`);
    if (plan.approverId !== userId)
      throw new ForbiddenException('Only the assigned approver can approve');
    if (plan.status !== OtPlanStatus.PENDING)
      throw new BadRequestException('Only pending plans can be approved');
    if (plan.version !== version)
      throw new ConflictException('Plan has been modified. Please refresh.');

    // Fetch additional data needed for notifications
    const [leader, approver, dept] = await Promise.all([
      this.userRepo.findOne({ where: { id: plan.createdBy } }),
      this.userRepo.findOne({ where: { id: userId } }),
      this.deptRepo.findOne({ where: { id: plan.departmentId } }),
    ]);

    const approvedAt = new Date();
    const approvedEmailIds: number[] = [];

    await this.dataSource.transaction(async (manager) => {
      plan.status = OtPlanStatus.APPROVED;
      plan.approvedAt = approvedAt;
      await manager.save(OtPlan, plan);

      // Balance CREDITs were already written at plan creation time — nothing to do here.

      // Notify dept leader
      if (leader) {
        const leaderEmailIds = await this.notificationsService.enqueueOtPlanApprovedNotification(
          id,
          leader.id,
          {
            leaderName: leader.username,
            departmentName: dept?.name || '',
            approverName: approver?.username || '',
            approvedAt: approvedAt.toISOString(),
            otPlanUrl: `${process.env.FRONTEND_URL}/ot-management/${id}`,
          },
          manager,
        );
        approvedEmailIds.push(...leaderEmailIds);
      }

      // Notify each employee in the plan
      for (const emp of plan.employees) {
        const empUser = await this.userRepo.findOne({ where: { id: emp.employeeId } });
        if (empUser) {
          const empEmailIds = await this.notificationsService.enqueueOtAssignmentApprovedNotification(
            id,
            emp.employeeId,
            {
              employeeName: empUser.username,
              otAssignmentUrl: `${process.env.FRONTEND_URL}/ot-management/assignments/${emp.id}`,
            },
            manager,
          );
          approvedEmailIds.push(...empEmailIds);
        }
      }
    });

    // Post-commit: trigger immediate send
    this.notificationsService.triggerImmediateSend(approvedEmailIds);

    return this.findOne(id, userId);
  }

  // ─── REJECT ─────────────────────────────────────────────────
  async rejectOtPlan(id: number, userId: number, reason: string, version: number) {
    const plan = await this.otPlanRepo.findOne({
      where: { id },
      relations: ['employees'],
    });
    if (!plan) throw new NotFoundException(`OT plan #${id} not found`);
    if (plan.approverId !== userId)
      throw new ForbiddenException('Only the assigned approver can reject');
    if (plan.status !== OtPlanStatus.PENDING)
      throw new BadRequestException('Only pending plans can be rejected');
    if (plan.version !== version)
      throw new ConflictException('Plan has been modified. Please refresh.');

    // Fetch data for notification
    const [leader, approver, dept] = await Promise.all([
      this.userRepo.findOne({ where: { id: plan.createdBy } }),
      this.userRepo.findOne({ where: { id: userId } }),
      this.deptRepo.findOne({ where: { id: plan.departmentId } }),
    ]);

    const rejectedAt = new Date();
    const rejectedEmailIds: number[] = [];

    await this.dataSource.transaction(async (manager) => {
      plan.status = OtPlanStatus.REJECTED;
      plan.rejectedReason = reason;
      plan.rejectedAt = rejectedAt;
      await manager.save(OtPlan, plan);

      // Reverse balance CREDITs written at plan creation
      for (const emp of plan.employees) {
        const creditTxs = await manager.find(OtBalanceTransaction, {
          where: { sourceType: OtBalanceSource.OT_PLAN_APPROVED, sourceId: Number(emp.id) },
        });
        for (const creditTx of creditTxs) {
          await manager.insert(OtBalanceTransaction, {
            employeeId: emp.employeeId,
            direction: OtBalanceDirection.DEBIT,
            amountMinutes: creditTx.amountMinutes,
            sourceType: OtBalanceSource.OT_PLAN_REJECTED,
            sourceId: Number(emp.id),
            periodYear: creditTx.periodYear,
            periodMonth: creditTx.periodMonth,
            periodDate: creditTx.periodDate,
            note: `OT plan #${id} rejected`,
          });
        }
      }

      // Notify dept leader
      if (leader) {
        const emailIds = await this.notificationsService.enqueueOtPlanRejectedNotification(
          id,
          leader.id,
          {
            leaderName: leader.username,
            departmentName: dept?.name || '',
            approverName: approver?.username || '',
            rejectedReason: reason,
            rejectedAt: rejectedAt.toISOString(),
            otPlanUrl: `${process.env.FRONTEND_URL}/ot-management/${id}`,
          },
          manager,
        );
        rejectedEmailIds.push(...emailIds);
      }
    });

    this.notificationsService.triggerImmediateSend(rejectedEmailIds);

    return this.findOne(id, userId);
  }

  // ─── CANCEL ─────────────────────────────────────────────────
  async cancelOtPlan(id: number, userId: number) {
    this.logger.log(`[cancelOtPlan] START id=${id} userId=${userId}`);

    const plan = await this.otPlanRepo.findOne({
      where: { id },
      relations: ['employees', 'employees.checkins'],
    });
    this.logger.log(`[cancelOtPlan] plan loaded: status=${plan?.status} employees=${plan?.employees?.length}`);

    if (!plan) throw new NotFoundException(`OT plan #${id} not found`);
    if (plan.createdBy !== userId) throw new ForbiddenException('Only the creator can cancel');
    if (plan.status !== OtPlanStatus.PENDING && plan.status !== OtPlanStatus.APPROVED) {
      throw new BadRequestException('Only pending or approved plans can be cancelled');
    }

    // AC-01: Block cancellation if any employee has already checked in
    const hasCheckedIn = plan.employees?.some((emp) =>
      emp.checkins?.some((c) => c.status !== OtCheckinStatus.PENDING),
    );
    this.logger.log(`[cancelOtPlan] hasCheckedIn=${hasCheckedIn}`);
    if (hasCheckedIn) {
      throw new BadRequestException(
        'Cannot cancel: one or more employees have already checked in',
      );
    }

    const wasApproved = plan.status === OtPlanStatus.APPROVED;

    // CC-01: fetch the current admin (BOD) in real-time
    this.logger.log(`[cancelOtPlan] fetching leader/BOD/dept...`);
    const [leader, currentBod, dept] = await Promise.all([
      this.userRepo.findOne({ where: { id: plan.createdBy } }),
      this.userRepo.findOne({ where: { role: UserRole.ADMIN } }),
      this.deptRepo.findOne({ where: { id: plan.departmentId } }),
    ]);
    this.logger.log(`[cancelOtPlan] leader=${leader?.id} bod=${currentBod?.id} dept=${dept?.id}`);
    const bod = currentBod;

    const cancelledEmailIds: number[] = [];
    const cancelledAt = new Date();

    try {
      await this.dataSource.transaction(async (manager) => {
        this.logger.log(`[cancelOtPlan] TX: updating plan status...`);
        await manager.update(OtPlan, { id }, { status: OtPlanStatus.CANCELLED, cancelledAt });

        // Reverse non-reconciled balance CREDITs (written at plan creation, PENDING or APPROVED)
        if (plan.employees) {
          for (const emp of plan.employees) {
            this.logger.log(`[cancelOtPlan] TX: checking reconciled count for empId=${emp.id}`);
            const reconciledCount = await manager.count(OtBalanceTransaction, {
              where: { sourceType: OtBalanceSource.OT_PLAN_RECONCILED, sourceId: Number(emp.id) },
            });
            if (reconciledCount > 0) {
              this.logger.log(`[cancelOtPlan] TX: empId=${emp.id} already reconciled, skipping`);
              continue;
            }

            const creditTxs = await manager.find(OtBalanceTransaction, {
              where: { sourceType: OtBalanceSource.OT_PLAN_APPROVED, sourceId: Number(emp.id) },
            });
            this.logger.log(`[cancelOtPlan] TX: empId=${emp.id} creditTxs=${creditTxs.length}`);

            for (const creditTx of creditTxs) {
              this.logger.log(`[cancelOtPlan] TX: inserting DEBIT tx for creditTx.id=${creditTx.id} amount=${creditTx.amountMinutes}`);
              await manager.insert(OtBalanceTransaction, {
                employeeId: emp.employeeId,
                direction: OtBalanceDirection.DEBIT,
                amountMinutes: creditTx.amountMinutes,
                sourceType: OtBalanceSource.OT_PLAN_CANCELLED,
                sourceId: Number(emp.id),
                periodYear: creditTx.periodYear,
                periodMonth: creditTx.periodMonth,
                periodDate: creditTx.periodDate,
                dayType: creditTx.dayType,
                otTypeId: creditTx.otTypeId,
                actualDate: creditTx.actualDate,
                note: `OT plan #${id} cancelled`,
              });
            }
          }
        }

        // Notify BOD
        if (bod) {
          this.logger.log(`[cancelOtPlan] TX: enqueue BOD email bod.id=${bod.id}`);
          const bodEmailIds = await this.notificationsService.enqueueOtPlanCancelledNotification(
            id,
            bod.id,
            {
              bodName: bod.username,
              leaderName: leader?.username || '',
              departmentName: dept?.name || '',
              otPlanUrl: `${process.env.FRONTEND_URL}/ot-management/${id}`,
            },
            manager,
          );
          cancelledEmailIds.push(...bodEmailIds);
        }

        // Notify employees only if plan was previously Approved
        if (wasApproved && plan.employees) {
          for (const emp of plan.employees) {
            const empUser = await this.userRepo.findOne({ where: { id: emp.employeeId } });
            if (empUser) {
              this.logger.log(`[cancelOtPlan] TX: enqueue employee email empId=${emp.employeeId}`);
              const empEmailIds = await this.notificationsService.enqueueOtAssignmentCancelledNotification(
                id,
                emp.employeeId,
                {
                  employeeName: empUser.username,
                  otAssignmentUrl: `${process.env.FRONTEND_URL}/ot-management/assignments/${emp.id}`,
                },
                manager,
              );
              cancelledEmailIds.push(...empEmailIds);
            }
          }
        }
      });
    } catch (err) {
      this.logger.error(`[cancelOtPlan] TRANSACTION FAILED: ${err?.message}`, err?.stack);
      throw err;
    }

    this.logger.log(`[cancelOtPlan] TX committed, triggering immediate send for ${cancelledEmailIds.length} emails`);
    this.notificationsService.triggerImmediateSend(cancelledEmailIds);

    return this.findOne(id, userId);
  }

  // ─── CHECK-IN ───────────────────────────────────────────────
  async checkin(userId: number, dto: CheckinDto) {
    this.logger.log(`[checkin] userId=${userId} otPlanEmployeeId=${dto.otPlanEmployeeId}`);

    const planEmp = await this.otPlanEmpRepo.findOne({
      where: { id: dto.otPlanEmployeeId },
      relations: ['otPlan'],
    });
    this.logger.log(`[checkin] planEmp=${JSON.stringify({ id: planEmp?.id, employeeId: planEmp?.employeeId, planStatus: planEmp?.otPlan?.status })}`);

    if (!planEmp) throw new NotFoundException('OT plan employee assignment not found');
    if (planEmp.employeeId !== userId)
      throw new ForbiddenException('You can only check in for yourself');
    if (planEmp.otPlan.status !== OtPlanStatus.APPROVED) {
      throw new BadRequestException('Can only check in for approved plans');
    }

    let checkin = await this.otCheckinRepo.findOne({
      where: { otPlanEmployeeId: planEmp.id, status: OtCheckinStatus.PENDING },
    });
    this.logger.log(`[checkin] existing PENDING checkin=${JSON.stringify({ id: checkin?.id, status: checkin?.status })}`);

    if (!checkin) {
      // Guard: ensure no active check-in already exists for this assignment
      const active = await this.otCheckinRepo.findOne({
        where: { otPlanEmployeeId: planEmp.id, status: OtCheckinStatus.CHECKED_IN },
      });
      this.logger.log(`[checkin] existing CHECKED_IN record=${JSON.stringify({ id: active?.id })}`);
      if (active) throw new BadRequestException('Already checked in for this assignment');
      // Create the missing PENDING record on-the-fly (handles legacy assignments
      // created before auto-PENDING creation was in place)
      this.logger.log(`[checkin] no PENDING found — creating on-the-fly for otPlanEmployeeId=${planEmp.id}`);
      checkin = this.otCheckinRepo.create({
        otPlanEmployeeId: planEmp.id,
        status: OtCheckinStatus.PENDING,
      });
    }

    checkin.status = OtCheckinStatus.CHECKED_IN;
    checkin.checkInAt = new Date();
    const saved = await this.otCheckinRepo.save(checkin);
    this.logger.log(`[checkin] saved checkin id=${saved.id} status=${saved.status} checkInAt=${saved.checkInAt}`);

    return { success: true, data: saved };
  }

  // ─── CHECK-OUT ──────────────────────────────────────────────
  async checkout(userId: number, dto: CheckoutDto) {
    const checkin = await this.otCheckinRepo.findOne({
      where: { id: dto.checkinId },
      relations: ['otPlanEmployee'],
    });
    if (!checkin) throw new NotFoundException('Check-in record not found');
    if (checkin.otPlanEmployee.employeeId !== userId) {
      throw new ForbiddenException('You can only check out for yourself');
    }
    if (checkin.status !== OtCheckinStatus.CHECKED_IN) {
      throw new BadRequestException('Can only check out after checking in');
    }
    if (checkin.version !== dto.version) {
      throw new ConflictException('Check-in has been modified. Please refresh.');
    }

    checkin.status = OtCheckinStatus.CHECKED_OUT;
    checkin.checkOutAt = new Date();
    checkin.actualDurationMinutes = computeDurationMinutes(
      new Date(checkin.checkInAt || ''),
      checkin.checkOutAt,
    );
    checkin.workOutput = dto.workOutput || null;
    checkin.compensatoryMethod = dto.compensatoryMethod || null;
    await this.otCheckinRepo.save(checkin);

    return { success: true, data: checkin };
  }

  // ─── APPROVE CHECK-IN ──────────────────────────────────────
  async approveCheckin(
    userId: number,
    checkinId: number,
    version: number,
    overrides: { checkInAt?: string; checkOutAt?: string; compensatoryMethod?: OtCompensatoryMethod } = {},
  ) {
    this.logger.log(`[approveCheckin] START userId=${userId} checkinId=${checkinId} version=${version} overrides=${JSON.stringify(overrides)}`);

    const checkin = await this.otCheckinRepo.findOne({
      where: { id: checkinId },
      relations: ['otPlanEmployee', 'otPlanEmployee.otPlan'],
    });
    this.logger.log(`[approveCheckin] checkin loaded: ${JSON.stringify({ id: checkin?.id, status: checkin?.status, version: checkin?.version, checkInAt: checkin?.checkInAt, checkOutAt: checkin?.checkOutAt, compensatoryMethod: checkin?.compensatoryMethod })}`);
    if (!checkin) throw new NotFoundException('Check-in record not found');

    // CC-01: Real-time dept leader check
    const plan = checkin.otPlanEmployee.otPlan;
    this.logger.log(`[approveCheckin] plan loaded: id=${plan?.id} departmentId=${plan?.departmentId} status=${plan?.status}`);
    const dept = await this.deptRepo.findOne({ where: { id: plan.departmentId } });
    this.logger.log(`[approveCheckin] dept loaded: id=${dept?.id} leaderId=${dept?.leaderId} requestUserId=${userId}`);
    if (dept?.leaderId !== userId) {
      this.logger.warn(`[approveCheckin] FORBIDDEN: dept.leaderId=${dept?.leaderId} !== userId=${userId}`);
      throw new ForbiddenException('Only the current department leader can approve check-ins');
    }
    if (
      checkin.status !== OtCheckinStatus.CHECKED_OUT &&
      checkin.status !== OtCheckinStatus.MISSED
    ) {
      this.logger.warn(`[approveCheckin] BAD_REQUEST: invalid status=${checkin.status}`);
      throw new BadRequestException('Can only approve checked-out or missed records');
    }
    if (checkin.version !== version) {
      this.logger.warn(`[approveCheckin] CONFLICT: checkin.version=${checkin.version} !== provided version=${version}`);
      throw new ConflictException('Check-in has been modified. Please refresh.');
    }

    // AC-02: Apply leader-overridden times (or require them for MISSED)
    const effectiveCheckIn  = overrides.checkInAt  ? new Date(overrides.checkInAt)  : checkin.checkInAt;
    const effectiveCheckOut = overrides.checkOutAt ? new Date(overrides.checkOutAt) : checkin.checkOutAt;
    this.logger.log(`[approveCheckin] effectiveCheckIn=${effectiveCheckIn?.toISOString()} effectiveCheckOut=${effectiveCheckOut?.toISOString()}`);
    if (!effectiveCheckIn || !effectiveCheckOut) {
      this.logger.warn(`[approveCheckin] BAD_REQUEST: missing effectiveCheckIn or effectiveCheckOut`);
      throw new BadRequestException(
        'Check-in and check-out times are required. Provide them via checkInAt/checkOutAt for missed records.',
      );
    }
    if (effectiveCheckOut <= effectiveCheckIn) {
      this.logger.warn(`[approveCheckin] BAD_REQUEST: checkOut <= checkIn`);
      throw new BadRequestException('Check-out time cannot be earlier than check-in time.');
    }

    const planEmp = checkin.otPlanEmployee;
    this.logger.log(`[approveCheckin] planEmp: id=${planEmp?.id} employeeId=${planEmp?.employeeId}`);
    const empUser = await this.userRepo.findOne({ where: { id: planEmp.employeeId } });
    this.logger.log(`[approveCheckin] empUser loaded: id=${empUser?.id} username=${empUser?.username}`);
    const confirmedEmailIds: number[] = [];

    return this.dataSource.transaction(async (manager) => {
      this.logger.log(`[approveCheckin] TX: start`);

      // Apply overrides to record
      if (overrides.checkInAt)  checkin.checkInAt  = effectiveCheckIn;
      if (overrides.checkOutAt) checkin.checkOutAt = effectiveCheckOut;
      if (overrides.compensatoryMethod) checkin.compensatoryMethod = overrides.compensatoryMethod;
      checkin.actualDurationMinutes = computeDurationMinutes(effectiveCheckIn, effectiveCheckOut);
      checkin.status = OtCheckinStatus.LEADER_APPROVED;
      checkin.leaderApprovedBy = userId;
      checkin.leaderApprovedAt = new Date();
      this.logger.log(`[approveCheckin] TX: saving checkin actualDurationMinutes=${checkin.actualDurationMinutes}`);
      await manager.save(OtCheckin, checkin);

      // ── Phase A: Reconcile plan reservation ────────────────
      // Reverse all OT_PLAN_APPROVED CREDITs for this plan employee
      const planCreditTxs = await manager.find(OtBalanceTransaction, {
        where: { sourceType: OtBalanceSource.OT_PLAN_APPROVED, sourceId: Number(planEmp.id) },
      });
      this.logger.log(`[approveCheckin] Phase A: planCreditTxs count=${planCreditTxs.length} for planEmp.id=${planEmp.id}`);
      for (const creditTx of planCreditTxs) {
        this.logger.log(`[approveCheckin] Phase A: reversing creditTx.id=${creditTx.id} amount=${creditTx.amountMinutes}`);
        await manager.save(OtBalanceTransaction, manager.create(OtBalanceTransaction, {
          employeeId: planEmp.employeeId,
          direction: OtBalanceDirection.DEBIT,
          amountMinutes: creditTx.amountMinutes,
          sourceType: OtBalanceSource.OT_PLAN_RECONCILED,
          sourceId: Number(planEmp.id),
          periodYear: creditTx.periodYear,
          periodMonth: creditTx.periodMonth,
          periodDate: creditTx.periodDate,
          dayType: creditTx.dayType,
          otTypeId: creditTx.otTypeId,
          actualDate: creditTx.actualDate,
          note: `Plan employee #${planEmp.id} reconciled on checkin confirm`,
        }));
      }

      // ── Phase B & C: Split actual hours ──────────────────────
      this.logger.log(`[approveCheckin] Phase B/C: splitting segments from ${effectiveCheckIn.toISOString()} to ${effectiveCheckOut.toISOString()}`);
      const rawSegments = await splitIntoSegments(
        effectiveCheckIn,
        effectiveCheckOut,
        this.calendarRepo,
      );
      this.logger.log(`[approveCheckin] Phase B/C: rawSegments count=${rawSegments.length}`);
      const segments = await applyCarryOver(rawSegments, this.calendarRepo);
      this.logger.log(`[approveCheckin] Phase B/C: segments after carryOver count=${segments.length} details=${JSON.stringify(segments.map(s => ({ dayType: s.dayType, durationMinutes: s.durationMinutes, actualDate: s.actualDate, attributedDate: s.attributedDate })))}`);

      // ── Phase D: Save OtCheckinItems ───────────────────────
      const otTypes   = await this.otTypeRepo.find();
      const otTypeMap = new Map(otTypes.map(t => [t.dayType as OtDayType, t]));
      this.logger.log(`[approveCheckin] Phase D: otTypes loaded count=${otTypes.length}`);

      for (const seg of segments) {
        const otType = otTypeMap.get(seg.dayType);
        if (!otType) {
          this.logger.warn(`[approveCheckin] Phase D: no otType for dayType=${seg.dayType}, skipping`);
          continue;
        }
        this.logger.log(`[approveCheckin] Phase D: saving OtCheckinItem dayType=${seg.dayType} duration=${seg.durationMinutes}`);
        await manager.save(OtCheckinItem, manager.create(OtCheckinItem, {
          otCheckinId: Number(checkin.id),
          employeeId: planEmp.employeeId,
          otTypeId: Number(otType.id),
          dayType: seg.dayType,
          startTime: seg.startTime,
          endTime: seg.endTime,
          durationMinutes: seg.durationMinutes,
          actualDate: seg.actualDate,
          attributedDate: seg.attributedDate,
        }));
      }

      // ── Phase E: Credit actual hours with monthly carry-over ─
      this.logger.log(`[approveCheckin] Phase E: getting monthlyBalanceMap for employeeId=${planEmp.employeeId}`);
      const monthlyMap = await this.getMonthlyBalanceMap(planEmp.employeeId);
      for (const seg of segments) {
        const otType = otTypeMap.get(seg.dayType);
        if (!otType) continue;
        const [periodYear, periodMonth] = this.assignPeriodWithCarryOver(
          seg.attributedDate,
          monthlyMap,
          seg.durationMinutes,
        );
        this.logger.log(`[approveCheckin] Phase E: crediting seg dayType=${seg.dayType} duration=${seg.durationMinutes} period=${periodYear}/${periodMonth}`);
        await manager.save(OtBalanceTransaction, manager.create(OtBalanceTransaction, {
          employeeId: planEmp.employeeId,
          direction: OtBalanceDirection.CREDIT,
          amountMinutes: seg.durationMinutes,
          sourceType: OtBalanceSource.OT_CHECKIN_APPROVED,
          sourceId: Number(checkin.id),
          periodYear,
          periodMonth,
          periodDate: seg.attributedDate,
          dayType: seg.dayType,
          otTypeId: Number(otType.id),
          actualDate: seg.actualDate,
          note: `OT check-in #${checkin.id} confirmed`,
        }));
      }

      // ── Phase F: Comp leave credit ────────────────────────
      const effectiveMethod = checkin.compensatoryMethod;
      this.logger.log(`[approveCheckin] Phase F: compensatoryMethod=${effectiveMethod}`);
      if (effectiveMethod === OtCompensatoryMethod.COMP_LEAVE) {
        const totalActualMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
        this.logger.log(`[approveCheckin] Phase F: crediting comp leave totalActualMinutes=${totalActualMinutes}`);
        await manager.save(CompBalanceTransaction, manager.create(CompBalanceTransaction, {
          employeeId: planEmp.employeeId,
          direction: CompTxDirection.CREDIT,
          amountMinutes: totalActualMinutes,
          sourceType: CompTxSource.OT_CHECKIN_APPROVED,
          sourceId: Number(checkin.id),
          note: `OT check-in #${checkin.id} confirmed — comp leave credit`,
        }));
      }

      // ── Phase G: Notify employee ──────────────────────────
      this.logger.log(`[approveCheckin] Phase G: empUser=${empUser?.id}`);
      if (empUser) {
        const emailIds = await this.notificationsService.enqueueOtCheckinConfirmedNotification(
          Number(checkin.id),
          planEmp.employeeId,
          {
            employeeName: empUser.username,
            otPlanTitle: plan.title,
            otAssignmentUrl: `${process.env.FRONTEND_URL}/ot-management/assignments/${planEmp.id}`,
          },
          manager,
        );
        this.logger.log(`[approveCheckin] Phase G: enqueued emailIds=${JSON.stringify(emailIds)}`);
        confirmedEmailIds.push(...emailIds);
      }

      this.logger.log(`[approveCheckin] TX: committed successfully`);
      return { success: true, data: checkin };
    }).then((result) => {
      this.logger.log(`[approveCheckin] TX committed, triggering immediate send for ${confirmedEmailIds.length} emails`);
      this.notificationsService.triggerImmediateSend(confirmedEmailIds);
      return result;
    }).catch((err) => {
      this.logger.error(`[approveCheckin] TRANSACTION FAILED: ${err?.message}`, err?.stack);
      throw err;
    });
  }

  // ─── REJECT CHECK-IN ───────────────────────────────────────
  async rejectCheckin(userId: number, checkinId: number, reason: string, version: number) {
    const checkin = await this.otCheckinRepo.findOne({
      where: { id: checkinId },
      relations: ['otPlanEmployee', 'otPlanEmployee.otPlan', 'otPlanEmployee.otPlan.department'],
    });
    if (!checkin) throw new NotFoundException('Check-in record not found');

    // CC-01: Real-time dept leader check
    const plan = checkin.otPlanEmployee.otPlan;
    const dept = await this.deptRepo.findOne({ where: { id: plan.departmentId } });
    if (dept?.leaderId !== userId) {
      throw new ForbiddenException('Only the current department leader can reject check-ins');
    }
    if (
      checkin.status !== OtCheckinStatus.CHECKED_OUT &&
      checkin.status !== OtCheckinStatus.MISSED
    ) {
      throw new BadRequestException('Can only reject checked-out or missed records');
    }
    if (checkin.version !== version) {
      throw new ConflictException('Check-in has been modified. Please refresh.');
    }

    const planEmp = checkin.otPlanEmployee;
    const empUser = await this.userRepo.findOne({ where: { id: planEmp.employeeId } });
    const rejectedEmailIds: number[] = [];

    await this.dataSource.transaction(async (manager) => {
      checkin.status = OtCheckinStatus.LEADER_REJECTED;
      checkin.rejectedReason = reason;
      checkin.actualDurationMinutes = 0;
      await manager.save(OtCheckin, checkin);

      // Reverse plan balance CREDITs (OT_PLAN_APPROVED → OT_PLAN_RECONCILED)
      const planCreditTxs = await manager.find(OtBalanceTransaction, {
        where: { sourceType: OtBalanceSource.OT_PLAN_APPROVED, sourceId: Number(planEmp.id) },
      });
      for (const creditTx of planCreditTxs) {
        await manager.insert(OtBalanceTransaction, {
          employeeId: planEmp.employeeId,
          direction: OtBalanceDirection.DEBIT,
          amountMinutes: creditTx.amountMinutes,
          sourceType: OtBalanceSource.OT_PLAN_RECONCILED,
          sourceId: Number(planEmp.id),
          periodYear: creditTx.periodYear,
          periodMonth: creditTx.periodMonth,
          periodDate: creditTx.periodDate,
          note: `OT check-in #${checkin.id} rejected`,
        });
      }

      // AC-06: Notify employee
      if (empUser) {
        const emailIds = await this.notificationsService.enqueueOtCheckinRejectedNotification(
          Number(checkin.id),
          planEmp.employeeId,
          {
            employeeName: empUser.username,
            otPlanTitle: plan.title,
            otAssignmentUrl: `${process.env.FRONTEND_URL}/ot-management/assignments/${planEmp.id}`,
          },
          manager,
        );
        rejectedEmailIds.push(...emailIds);
      }
    });

    this.notificationsService.triggerImmediateSend(rejectedEmailIds);

    return { success: true, data: checkin };
  }

  //  ─── EMPLOYEE OT SUMMARY ───────────────────────────────────
  async getEmployeeOtSummary(employeeId: number) {
    return this.otBalanceService.getEmployeeSummary(employeeId);
  }

  // ─── EXPORT ─────────────────────────────────────────────────
  async exportReport(query: ListOtPlansQueryDto): Promise<Buffer> {
    // Fetch all plans matching filters (no pagination)
    const plans = await this.otPlanRepo.find({
      relations: ['department', 'employees', 'employees.employee', 'employees.checkins'],
      order: { createdAt: 'DESC' },
    });

    // Apply filters
    let filtered = plans;

    if (query.status && query.status.length > 0) {
      const statusFilter = query.status;
      filtered = filtered.filter((p) => statusFilter.includes(p.status));
    }
    if (query.q) {
      const search = query.q.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          (p.department?.name || '').toLowerCase().includes(search),
      );
    }

    const headers = [
      'Plan ID',
      'Title',
      'Department',
      'Status',
      'Employee Name',
      'Employee Email',
      'Start Time',
      'End Time',
      'Planned Duration (hrs)',
      'Planned Task',
      'Check-in Status',
      'Actual Duration (hrs)',
      'Work Output',
      'Compensatory Method',
    ];

    const rows = [headers.join(',')];

    for (const plan of filtered) {
      for (const emp of plan.employees || []) {
        const checkin = emp.checkins?.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];

        rows.push(
          [
            formatOtPlanCode(plan.id, plan.createdAt),
            this.csvEscape(plan.title),
            this.csvEscape(plan.department?.name || ''),
            plan.status,
            this.csvEscape(emp.employee?.username || ''),
            this.csvEscape(emp.employee?.email || ''),
            emp.startTime ? new Date(emp.startTime).toISOString() : '',
            emp.endTime ? new Date(emp.endTime).toISOString() : '',
            (emp.durationMinutes / 60).toFixed(1),
            this.csvEscape(emp.plannedTask),
            checkin?.status || OtCheckinStatus.PENDING,
            checkin?.actualDurationMinutes ? (checkin.actualDurationMinutes / 60).toFixed(1) : '',
            this.csvEscape(checkin?.workOutput || ''),
            checkin?.compensatoryMethod || '',
          ].join(','),
        );
      }
    }

    // BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    return Buffer.from(bom + rows.join('\n'), 'utf-8');
  }

  // ─── MY ASSIGNMENTS (Personal view) ──────────────────────

  private deriveAssignedStatus(
    planStatus: OtPlanStatus,
    checkinStatus?: OtCheckinStatus,
  ): string {
    if (planStatus === OtPlanStatus.CANCELLED) return 'cancelled';
    if (planStatus === OtPlanStatus.APPROVED) {
      if (!checkinStatus || checkinStatus === OtCheckinStatus.PENDING) return 'approved';
      if (checkinStatus === OtCheckinStatus.CHECKED_IN) return 'checked_in';
      if (checkinStatus === OtCheckinStatus.CHECKED_OUT) return 'checked_out';
      if (checkinStatus === OtCheckinStatus.LEADER_APPROVED) return 'confirmed';
      if (checkinStatus === OtCheckinStatus.LEADER_REJECTED) return 'rejected';
      if (checkinStatus === OtCheckinStatus.MISSED) return 'missed';
    }
    return planStatus as string;
  }

  async getMyAssignments(
    userId: number,
    query: {
      page?: number;
      pageSize?: number;
      otBenefits?: string;
      from?: string;
      to?: string;
      status?: string;
    },
  ) {
    const { page = 1, pageSize = 10, otBenefits, from, to, status } = query;

    const qb = this.otPlanEmpRepo
      .createQueryBuilder('pe')
      .leftJoinAndSelect('pe.otPlan', 'plan')
      .leftJoinAndSelect('pe.checkins', 'checkin')
      .where('pe.employeeId = :userId', { userId })
      .orderBy('pe.startTime', 'DESC');

    if (from) {
      qb.andWhere('pe.startTime >= :from', { from: new Date(`${from}T00:00:00`) });
    }
    if (to) {
      qb.andWhere('pe.startTime <= :to', { to: new Date(`${to}T23:59:59`) });
    }

    const assignments = await qb.getMany();

    const mapped = assignments.map((pe) => {
      const latestCheckin = pe.checkins?.length
        ? [...pe.checkins].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0]
        : null;

      const assignedStatus = this.deriveAssignedStatus(
        pe.otPlan?.status,
        latestCheckin?.status,
      );

      const planIdStr = String(pe.otPlanId).padStart(3, '0');
      const empIdStr = String(pe.id).padStart(3, '0');
      const assignedOtId = `#OT-${planIdStr}-${empIdStr}`;

      return {
        id: pe.id,
        assignedOtId,
        planId: pe.otPlanId,
        planTitle: pe.otPlan?.title || '',
        startTime: pe.startTime,
        endTime: pe.endTime,
        durationMinutes: pe.durationMinutes,
        actualDurationMinutes: latestCheckin?.actualDurationMinutes ?? null,
        compensatoryMethod: latestCheckin?.compensatoryMethod ?? null,
        status: assignedStatus,
        plannedTask: pe.plannedTask,
        checkin: latestCheckin
          ? {
              id: latestCheckin.id,
              status: latestCheckin.status,
              checkInAt: latestCheckin.checkInAt,
              checkOutAt: latestCheckin.checkOutAt,
              actualDurationMinutes: latestCheckin.actualDurationMinutes,
              workOutput: latestCheckin.workOutput,
              compensatoryMethod: latestCheckin.compensatoryMethod,
              rejectedReason: latestCheckin.rejectedReason,
              version: latestCheckin.version,
            }
          : null,
      };
    });

    // Filter by derived status
    const filtered1 = status ? mapped.filter((a) => a.status === status) : mapped;
    // Filter by OT benefits (compensatory method) on confirmed/checked_out records
    const filtered2 = otBenefits
      ? filtered1.filter((a) => a.compensatoryMethod === otBenefits)
      : filtered1;

    const total = filtered2.length;
    const paged = filtered2.slice((page - 1) * pageSize, page * pageSize);

    return {
      success: true,
      data: paged,
      page: { page, pageSize, total },
    };
  }

  // ─── GET ASSIGNMENT DETAIL (Admin view, no userId restriction) ────────────
  async getOtPlanEmployeeDetail(assignmentId: number) {
    const pe = await this.otPlanEmpRepo.findOne({
      where: { id: assignmentId },
      relations: ['otPlan', 'checkins', 'employee', 'employee.department'],
    });
    if (!pe) {
      throw new NotFoundException(`Assignment #${assignmentId} not found`);
    }

    const latestCheckin = pe.checkins?.length
      ? [...pe.checkins].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]
      : null;

    const assignedStatus = this.deriveAssignedStatus(
      pe.otPlan?.status,
      latestCheckin?.status,
    );

    const planIdStr = String(pe.otPlanId).padStart(3, '0');
    const empIdStr = String(pe.id).padStart(3, '0');
    const assignedOtId = `#OT-${planIdStr}-${empIdStr}`;

    return {
      success: true,
      data: {
        id: pe.id,
        assignedOtId,
        planId: pe.otPlanId,
        planTitle: pe.otPlan?.title || '',
        startTime: pe.startTime,
        endTime: pe.endTime,
        durationMinutes: pe.durationMinutes,
        plannedTask: pe.plannedTask,
        status: assignedStatus,
        employee: {
          id: pe.employee?.id,
          username: pe.employee?.username || '',
          employeeId: pe.employee?.employeeId || '',
          email: pe.employee?.email || '',
          position: pe.employee?.position || '',
          departmentName: (pe.employee as any)?.department?.name || '',
        },
        checkin: latestCheckin
          ? {
              id: latestCheckin.id,
              status: latestCheckin.status,
              checkInAt: latestCheckin.checkInAt,
              checkOutAt: latestCheckin.checkOutAt,
              actualDurationMinutes: latestCheckin.actualDurationMinutes,
              workOutput: latestCheckin.workOutput,
              compensatoryMethod: latestCheckin.compensatoryMethod,
              rejectedReason: latestCheckin.rejectedReason,
              version: latestCheckin.version,
            }
          : null,
      },
    };
  }

  async getMyAssignment(userId: number, assignmentId: number) {
    const pe = await this.otPlanEmpRepo.findOne({
      where: { id: assignmentId, employeeId: userId },
      relations: ['otPlan', 'checkins'],
    });
    if (!pe) {
      throw new NotFoundException(`Assignment #${assignmentId} not found`);
    }

    const latestCheckin = pe.checkins?.length
      ? [...pe.checkins].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]
      : null;

    const assignedStatus = this.deriveAssignedStatus(
      pe.otPlan?.status,
      latestCheckin?.status,
    );

    const planIdStr = String(pe.otPlanId).padStart(3, '0');
    const empIdStr = String(pe.id).padStart(3, '0');
    const assignedOtId = `#OT-${planIdStr}-${empIdStr}`;

    return {
      success: true,
      data: {
        id: pe.id,
        assignedOtId,
        planId: pe.otPlanId,
        planTitle: pe.otPlan?.title || '',
        startTime: pe.startTime,
        endTime: pe.endTime,
        durationMinutes: pe.durationMinutes,
        plannedTask: pe.plannedTask,
        status: assignedStatus,
        checkin: latestCheckin
          ? {
              id: latestCheckin.id,
              status: latestCheckin.status,
              checkInAt: latestCheckin.checkInAt,
              checkOutAt: latestCheckin.checkOutAt,
              actualDurationMinutes: latestCheckin.actualDurationMinutes,
              workOutput: latestCheckin.workOutput,
              compensatoryMethod: latestCheckin.compensatoryMethod,
              rejectedReason: latestCheckin.rejectedReason,
              version: latestCheckin.version,
            }
          : null,
      },
    };
  }

  private csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  /** Net OT minutes for an employee in a given year (CREDITs minus DEBITs). */
  private async getYearlyNetMinutes(employeeId: number, year: number): Promise<number> {
    const txs = await this.otBalanceRepo.find({ where: { employeeId, periodYear: year } });
    return txs.reduce(
      (sum, tx) => sum + (tx.direction === OtBalanceDirection.CREDIT ? tx.amountMinutes : -tx.amountMinutes),
      0,
    );
  }

  /**
   * Net OT minutes per month for an employee, keyed by `"YYYY-M"`.
   */
  private async getMonthlyBalanceMap(employeeId: number): Promise<Map<string, number>> {
    const txs = await this.otBalanceRepo.find({ where: { employeeId } });
    const map = new Map<string, number>();
    for (const tx of txs) {
      const key = `${tx.periodYear}-${tx.periodMonth}`;
      const delta = tx.direction === OtBalanceDirection.CREDIT ? tx.amountMinutes : -tx.amountMinutes;
      map.set(key, (map.get(key) ?? 0) + delta);
    }
    return map;
  }

  /**
   * Determine which (year, month) bucket a segment belongs to,
   * bumping to the next month when the current would exceed 2 400 min (40 h).
   * Updates `monthlyMap` in-place.
   */
  private assignPeriodWithCarryOver(
    attributedDate: string,
    monthlyMap: Map<string, number>,
    addMinutes: number,
  ): [number, number] {
    const d = new Date(`${attributedDate}T12:00:00`);
    let year  = d.getFullYear();
    let month = d.getMonth() + 1;
    const MONTHLY_CAP = 2_400;
    while (true) {
      const key     = `${year}-${month}`;
      const current = monthlyMap.get(key) ?? 0;
      if (current + addMinutes <= MONTHLY_CAP) {
        monthlyMap.set(key, current + addMinutes);
        return [year, month];
      }
      month++;
      if (month > 12) { month = 1; year++; }
    }
  }
}
