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
import { OtBalanceTransaction } from '@/entities/ot-balance-transaction.entity';
import { User } from '@/entities/users.entity';
import { Department } from '@/entities/departments.entity';
import { CalendarOverride } from '@/entities/calendar-override.entity';
import { OtPlanStatus } from '@/common/enums/ot-plan-status.enum';
import { OtCheckinStatus } from '@/common/enums/ot-checkin-status.enum';
import { OtBalanceSource } from '@/common/enums/ot-balance-source.enum';
import { OtDayType } from '@/common/enums/ot-day-type.enum';
import { UserRole } from '@/common/enums/roles.enum';
import { CreateOtPlanDto } from './dto/create-ot-plan.dto';
import { UpdateOtPlanDto } from './dto/update-ot-plan.dto';
import { ListOtPlansQueryDto, OtPlanView } from './dto/list-ot-plans-query.dto';
import { CheckinDto } from './dto/checkin.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { OtBalanceService } from './ot-balance.service';
import { resolveDayType } from './utils/day-type-resolver';
import { computeDurationMinutes, resolveOtTimeType } from './utils/duration-calculator';
import { formatOtPlanCode } from './utils/ot-plan-code-formatter';
import { AppException, ErrorCode } from '@/common';

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
    @InjectRepository(OtBalanceTransaction)
    private readonly otBalanceRepo: Repository<OtBalanceTransaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    @InjectRepository(CalendarOverride)
    private readonly calendarRepo: Repository<CalendarOverride>,
    private readonly dataSource: DataSource,
    private readonly otBalanceService: OtBalanceService,
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

    return this.dataSource.transaction(async (manager) => {
      // Create OT Plan
      const plan = manager.create(OtPlan, {
        title: dto.title,
        description: dto.description || null,
        departmentId: user.departmentId,
        createdBy: userId,
        approverId: approver.id,
        status: OtPlanStatus.PENDING,
        totalDurationMinutes: 0,
      } as Partial<OtPlan> );
      const savedPlan = await manager.save(OtPlan, plan);

      let totalMinutes = 0;

      for (const empDto of dto.employees) {
        const start = new Date(empDto.startTime);
        const end = new Date(empDto.endTime);
        const durationMinutes = computeDurationMinutes(start, end);
        const dayType = await resolveDayType(start, this.calendarRepo);
        const otTimeType = resolveOtTimeType(start, end);

        const planEmp = manager.create(OtPlanEmployee, {
          otPlanId: savedPlan.id,
          employeeId: empDto.employeeId,
          startTime: start,
          endTime: end,
          durationMinutes,
          plannedTask: empDto.plannedTask,
          dayType,
          otTimeType,
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

      // Update total duration
      savedPlan.totalDurationMinutes = totalMinutes;
      await manager.save(OtPlan, savedPlan);

      return this.findOne(savedPlan.id, userId);
    });
  }

  // ─── FIND ALL (LIST) ────────────────────────────────────────
  async findOtPlans(user: { id: number; role: string }, query: ListOtPlansQueryDto) {
    const { view, page = 1, pageSize = 10, status, from, to, q, sort } = query;

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
      const canCancel =
        isCreator &&
        (plan.status === OtPlanStatus.PENDING || plan.status === OtPlanStatus.APPROVED);
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
        dayType: emp.dayType,
        otTimeType: emp.otTimeType,
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
          (plan.status === OtPlanStatus.PENDING || plan.status === OtPlanStatus.APPROVED),
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

    return this.dataSource.transaction(async (manager) => {
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
        const dayType = await resolveDayType(start, this.calendarRepo);
        const otTimeType = resolveOtTimeType(start, end);

        const planEmp = manager.create(OtPlanEmployee, {
          otPlanId: id,
          employeeId: empDto.employeeId,
          startTime: start,
          endTime: end,
          durationMinutes,
          plannedTask: empDto.plannedTask,
          dayType,
          otTimeType,
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

      return this.findOne(id, userId);
    });
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

    return this.dataSource.transaction(async (manager) => {
      plan.status = OtPlanStatus.APPROVED;
      plan.approvedAt = new Date();
      await manager.save(OtPlan, plan);

      // Create balance transactions for each employee
      for (const emp of plan.employees) {
        const startDate = new Date(emp.startTime);
        const tx = manager.create(OtBalanceTransaction, {
          employeeId: emp.employeeId,
          direction: 'CREDIT',
          amountMinutes: emp.durationMinutes,
          sourceType: OtBalanceSource.OT_PLAN_APPROVED,
          sourceId: emp.id,
          periodYear: startDate.getFullYear(),
          periodMonth: startDate.getMonth() + 1,
          periodDate: startDate.toISOString().slice(0, 10),
          note: `OT plan #${id} approved`,
        });
        await manager.save(OtBalanceTransaction, tx);
      }

      return this.findOne(id, userId);
    });
  }

  // ─── REJECT ─────────────────────────────────────────────────
  async rejectOtPlan(id: number, userId: number, reason: string, version: number) {
    const plan = await this.otPlanRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`OT plan #${id} not found`);
    if (plan.approverId !== userId)
      throw new ForbiddenException('Only the assigned approver can reject');
    if (plan.status !== OtPlanStatus.PENDING)
      throw new BadRequestException('Only pending plans can be rejected');
    if (plan.version !== version)
      throw new ConflictException('Plan has been modified. Please refresh.');

    plan.status = OtPlanStatus.REJECTED;
    plan.rejectedReason = reason;
    plan.rejectedAt = new Date();
    await this.otPlanRepo.save(plan);

    return this.findOne(id, userId);
  }

  // ─── CANCEL ─────────────────────────────────────────────────
  async cancelOtPlan(id: number, userId: number) {
    const plan = await this.otPlanRepo.findOne({
      where: { id },
      relations: ['employees'],
    });
    if (!plan) throw new NotFoundException(`OT plan #${id} not found`);
    if (plan.createdBy !== userId) throw new ForbiddenException('Only the creator can cancel');
    if (plan.status !== OtPlanStatus.PENDING && plan.status !== OtPlanStatus.APPROVED) {
      throw new BadRequestException('Only pending or approved plans can be cancelled');
    }

    return this.dataSource.transaction(async (manager) => {
      const wasApproved = plan.status === OtPlanStatus.APPROVED;

      plan.status = OtPlanStatus.CANCELLED;
      plan.cancelledAt = new Date();
      await manager.save(OtPlan, plan);

      // If was approved, create reversal balance transactions
      if (wasApproved && plan.employees) {
        for (const emp of plan.employees) {
          const startDate = new Date(emp.startTime);
          const tx = manager.create(OtBalanceTransaction, {
            employeeId: emp.employeeId,
            direction: 'DEBIT',
            amountMinutes: emp.durationMinutes,
            sourceType: OtBalanceSource.OT_PLAN_CANCELLED,
            sourceId: emp.id,
            periodYear: startDate.getFullYear(),
            periodMonth: startDate.getMonth() + 1,
            periodDate: startDate.toISOString().slice(0, 10),
            note: `OT plan #${id} cancelled`,
          });
          await manager.save(OtBalanceTransaction, tx);
        }
      }

      return this.findOne(id, userId);
    });
  }

  // ─── CHECK-IN ───────────────────────────────────────────────
  async checkin(userId: number, dto: CheckinDto) {
    const planEmp = await this.otPlanEmpRepo.findOne({
      where: { id: dto.otPlanEmployeeId },
      relations: ['otPlan'],
    });
    if (!planEmp) throw new NotFoundException('OT plan employee assignment not found');
    if (planEmp.employeeId !== userId)
      throw new ForbiddenException('You can only check in for yourself');
    if (planEmp.otPlan.status !== OtPlanStatus.APPROVED) {
      throw new BadRequestException('Can only check in for approved plans');
    }

    const checkin = await this.otCheckinRepo.findOne({
      where: { otPlanEmployeeId: planEmp.id, status: OtCheckinStatus.PENDING },
    });
    if (!checkin) throw new BadRequestException('No pending check-in found');

    checkin.status = OtCheckinStatus.CHECKED_IN;
    checkin.checkInAt = new Date();
    await this.otCheckinRepo.save(checkin);

    return { success: true, data: checkin };
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
  async approveCheckin(userId: number, checkinId: number, version: number) {
    const checkin = await this.otCheckinRepo.findOne({
      where: { id: checkinId },
      relations: ['otPlanEmployee', 'otPlanEmployee.otPlan'],
    });
    if (!checkin) throw new NotFoundException('Check-in record not found');

    // Verify user is department leader
    const plan = checkin.otPlanEmployee.otPlan;
    if (plan.createdBy !== userId) {
      throw new ForbiddenException(
        'Only the plan creator (department leader) can approve check-ins',
      );
    }
    if (checkin.status !== OtCheckinStatus.CHECKED_OUT) {
      throw new BadRequestException('Can only approve checked-out records');
    }
    if (checkin.version !== version) {
      throw new ConflictException('Check-in has been modified. Please refresh.');
    }

    return this.dataSource.transaction(async (manager) => {
      checkin.status = OtCheckinStatus.LEADER_APPROVED;
      checkin.leaderApprovedBy = userId;
      checkin.leaderApprovedAt = new Date();
      await manager.save(OtCheckin, checkin);

      // Create balance transaction for actual hours
      const startDate = new Date(checkin.otPlanEmployee.startTime);
      const tx = manager.create(OtBalanceTransaction, {
        employeeId: checkin.otPlanEmployee.employeeId,
        direction: 'CREDIT',
        amountMinutes: checkin.actualDurationMinutes || 0,
        sourceType: OtBalanceSource.OT_CHECKIN_APPROVED,
        sourceId: Number(checkin.id),
        periodYear: startDate.getFullYear(),
        periodMonth: startDate.getMonth() + 1,
        periodDate: startDate.toISOString().slice(0, 10),
        note: `OT check-in approved`,
      });
      await manager.save(OtBalanceTransaction, tx);

      return { success: true, data: checkin };
    });
  }

  // ─── REJECT CHECK-IN ───────────────────────────────────────
  async rejectCheckin(userId: number, checkinId: number, reason: string, version: number) {
    const checkin = await this.otCheckinRepo.findOne({
      where: { id: checkinId },
      relations: ['otPlanEmployee', 'otPlanEmployee.otPlan'],
    });
    if (!checkin) throw new NotFoundException('Check-in record not found');

    const plan = checkin.otPlanEmployee.otPlan;
    if (plan.createdBy !== userId) {
      throw new ForbiddenException(
        'Only the plan creator (department leader) can reject check-ins',
      );
    }
    if (checkin.status !== OtCheckinStatus.CHECKED_OUT) {
      throw new BadRequestException('Can only reject checked-out records');
    }
    if (checkin.version !== version) {
      throw new ConflictException('Check-in has been modified. Please refresh.');
    }

    checkin.status = OtCheckinStatus.LEADER_REJECTED;
    checkin.rejectedReason = reason;
    await this.otCheckinRepo.save(checkin);

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
      'Day Type',
      'OT Time Type',
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
            emp.dayType,
            emp.otTimeType,
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

  private csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
