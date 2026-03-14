import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtBalanceTransaction } from '@/entities/ot-balance-transaction.entity';
import { SystemSetting } from '@/entities/system-setting.entity';
import { OtBalanceDirection } from '@/common/enums/ot-balance-direction.enum';
import { OtBalanceSource } from '@/common/enums/ot-balance-source.enum';
import { toVN, vnNow } from '@/common/utils/date.util';

export interface OtPolicy {
  maxOtHoursPerDay: number;
  maxOtHoursPerDayHoliday: number;
  maxOtHoursPerMonth: number;
  maxOtHoursPerYear: number;
}

export interface EmployeeOtSummary {
  employeeId: number;
  otHoursToday: number;
  otHoursThisMonth: number;
  otHoursThisYear: number;
}

export interface EmployeeOtSummaryDetailed extends EmployeeOtSummary {
  otHoursTodayBroughtForward: number;
  otHoursTodayCarriedForward: number;
  otHoursThisMonthBroughtForward: number;
  otHoursThisMonthCarriedForward: number;
  otHoursThisYearBroughtForward: number;
  otHoursThisYearCarriedForward: number;
}

@Injectable()
export class OtBalanceService {
  private readonly logger = new Logger(OtBalanceService.name);

  constructor(
    @InjectRepository(OtBalanceTransaction)
    private readonly otBalanceRepo: Repository<OtBalanceTransaction>,
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
  ) {}

  async getOtPolicy(): Promise<OtPolicy> {
    const rows = await this.settingRepo.find({ where: { category: 'ot_policy' } });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      maxOtHoursPerDay: this.toNumber(map.get('max_ot_hours_per_day'), 4),
      maxOtHoursPerDayHoliday: this.toNumber(map.get('max_ot_hours_per_day_holiday'), 8),
      maxOtHoursPerMonth: this.toNumber(map.get('max_ot_hours_per_month'), 40),
      maxOtHoursPerYear: this.toNumber(map.get('max_ot_hours_per_year'), 200),
    };
  }

  async getEmployeeSummary(
    employeeId: number,
    referenceDate?: Date,
    excludePlanEmpIds?: number[],
  ): Promise<EmployeeOtSummary> {
    const ref = toVN(referenceDate || new Date());
    const year = ref.year();
    const month = ref.month() + 1;
    const dateStr = ref.format('YYYY-MM-DD');

    // Helper: exclude old plan-creation credits so update balance checks aren't inflated
    const applyExclusion = (qb: ReturnType<typeof this.otBalanceRepo.createQueryBuilder>) => {
      if (excludePlanEmpIds?.length) {
        qb.andWhere(
          'NOT (t.source_type = :excType AND t.source_id IN (:...excIds))',
          { excType: OtBalanceSource.OT_PLAN_CREATED, excIds: excludePlanEmpIds },
        );
      }
      return qb;
    };

    // Daily hours
    const dailyQb = this.otBalanceRepo
      .createQueryBuilder('t')
      .select(
        "COALESCE(SUM(CASE WHEN t.direction = :direction THEN t.amount_minutes ELSE -t.amount_minutes END), 0)",
        'minutes',
      )
      .where('t.employee_id = :employeeId', { employeeId })
      .andWhere('t.period_date = :dateStr', { dateStr })
      .setParameter('direction', OtBalanceDirection.CREDIT);
    const dailyResult = await applyExclusion(dailyQb).getRawOne();

    // Monthly hours
    const monthlyQb = this.otBalanceRepo
      .createQueryBuilder('t')
      .select(
        "COALESCE(SUM(CASE WHEN t.direction = :direction THEN t.amount_minutes ELSE -t.amount_minutes END), 0)",
        'minutes',
      )
      .where('t.employee_id = :employeeId', { employeeId })
      .setParameter('direction', OtBalanceDirection.CREDIT)
      .andWhere('t.period_year = :year', { year })
      .andWhere('t.period_month = :month', { month });
    const monthlyResult = await applyExclusion(monthlyQb).getRawOne();

    // Yearly hours
    const yearlyQb = this.otBalanceRepo
      .createQueryBuilder('t')
      .select(
        "COALESCE(SUM(CASE WHEN t.direction = :direction THEN t.amount_minutes ELSE -t.amount_minutes END), 0)",
        'minutes',
      )
      .where('t.employee_id = :employeeId', { employeeId })
      .setParameter('direction', OtBalanceDirection.CREDIT)
      .andWhere('t.period_year = :year', { year });
    const yearlyResult = await applyExclusion(yearlyQb).getRawOne();

    return {
      employeeId,
      otHoursToday: Math.round(((Number(dailyResult?.minutes) || 0) / 60) * 10) / 10,
      otHoursThisMonth: Math.round(((Number(monthlyResult?.minutes) || 0) / 60) * 10) / 10,
      otHoursThisYear: Math.round(((Number(yearlyResult?.minutes) || 0) / 60) * 10) / 10,
    };
  }

  async getOtSummaryByFilter(
    employeeId: number,
    year: number,
    month: number,
  ): Promise<EmployeeOtSummaryDetailed> {
    const todayStr = vnNow().format('YYYY-MM-DD');
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const firstOfNextMonth = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const firstOfYear = `${year}-01-01`;
    const firstOfNextYear = `${year + 1}-01-01`;

    const net = (d: OtBalanceDirection) =>
      `COALESCE(SUM(CASE WHEN t.direction = '${d}' THEN t.amount_minutes ELSE -t.amount_minutes END), 0)`;
    const select = net(OtBalanceDirection.CREDIT);

    const [
      daily, dailyBF, dailyCF,
      monthly, monthlyBF, monthlyCF,
      yearly, yearlyBF, yearlyCF,
    ] = await Promise.all([
      // Daily total (period_date = today)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.period_date = :today', { today: todayStr })
        .getRawOne(),

      // Daily brought forward (work before today → attributed TO today)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.period_date = :today', { today: todayStr })
        .andWhere('t.actual_date IS NOT NULL')
        .andWhere('t.actual_date < :today', { today: todayStr })
        .getRawOne(),

      // Daily carried forward (work today → attributed to future)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.actual_date = :today', { today: todayStr })
        .andWhere('t.period_date IS NOT NULL')
        .andWhere('t.period_date > :today', { today: todayStr })
        .getRawOne(),

      // Monthly total (period_year=year, period_month=month)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.period_year = :year', { year })
        .andWhere('t.period_month = :month', { month })
        .getRawOne(),

      // Monthly brought forward (work before this month → attributed TO this month)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.period_year = :year', { year })
        .andWhere('t.period_month = :month', { month })
        .andWhere('t.actual_date IS NOT NULL')
        .andWhere('t.actual_date < :firstOfMonth', { firstOfMonth })
        .getRawOne(),

      // Monthly carried forward (work in this month → attributed to future month)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.actual_date IS NOT NULL')
        .andWhere('t.actual_date >= :firstOfMonth', { firstOfMonth })
        .andWhere('t.actual_date < :firstOfNextMonth', { firstOfNextMonth })
        .andWhere('NOT (t.period_year = :year AND t.period_month = :month)', { year, month })
        .getRawOne(),

      // Yearly total (period_year = year)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.period_year = :year', { year })
        .getRawOne(),

      // Yearly brought forward (work before this year → attributed TO this year)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.period_year = :year', { year })
        .andWhere('t.actual_date IS NOT NULL')
        .andWhere('t.actual_date < :firstOfYear', { firstOfYear })
        .getRawOne(),

      // Yearly carried forward (work in this year → attributed to future year)
      this.otBalanceRepo.createQueryBuilder('t')
        .select(select, 'minutes')
        .where('t.employee_id = :id', { id: employeeId })
        .andWhere('t.actual_date IS NOT NULL')
        .andWhere('t.actual_date >= :firstOfYear', { firstOfYear })
        .andWhere('t.actual_date < :firstOfNextYear', { firstOfNextYear })
        .andWhere('t.period_year > :year', { year })
        .getRawOne(),
    ]);

    const toHours = (row: { minutes: unknown }) =>
      Math.round(((Number(row?.minutes) || 0) / 60) * 100) / 100;

    return {
      employeeId,
      otHoursToday: toHours(daily),
      otHoursTodayBroughtForward: toHours(dailyBF),
      otHoursTodayCarriedForward: toHours(dailyCF),
      otHoursThisMonth: toHours(monthly),
      otHoursThisMonthBroughtForward: toHours(monthlyBF),
      otHoursThisMonthCarriedForward: toHours(monthlyCF),
      otHoursThisYear: toHours(yearly),
      otHoursThisYearBroughtForward: toHours(yearlyBF),
      otHoursThisYearCarriedForward: toHours(yearlyCF),
    };
  }

  async validateOtLimits(
    employeeId: number,
    date: Date,
    additionalMinutes: number,
    isHoliday: boolean,
    excludePlanEmpIds?: number[],
  ): Promise<{
    valid: boolean;
    violations: string[];
    details: {
      employeeId: number;
      otHoursToday: number;
      otHoursThisMonth: number;
      otHoursThisYear: number;
      dailyLimit: number;
      monthlyLimit: number;
      yearlyLimit: number;
    };
  }> {
    const policy = await this.getOtPolicy();
    const summary = await this.getEmployeeSummary(employeeId, date, excludePlanEmpIds);
    const violations: string[] = [];

    const additionalHours = additionalMinutes / 60;
    const dailyMax = isHoliday ? policy.maxOtHoursPerDayHoliday : policy.maxOtHoursPerDay;

    if (summary.otHoursToday + additionalHours > dailyMax) {
      violations.push(
        `Daily OT limit exceeded: ${summary.otHoursToday + additionalHours}h / ${dailyMax}h max`,
      );
    }

    if (summary.otHoursThisMonth + additionalHours > policy.maxOtHoursPerMonth) {
      violations.push(
        `Monthly OT limit exceeded: ${summary.otHoursThisMonth + additionalHours}h / ${policy.maxOtHoursPerMonth}h max`,
      );
    }

    if (summary.otHoursThisYear + additionalHours > policy.maxOtHoursPerYear) {
      violations.push(
        `Yearly OT limit exceeded: ${summary.otHoursThisYear + additionalHours}h / ${policy.maxOtHoursPerYear}h max`,
      );
    }

    return {
      valid: violations.length === 0,
      violations,
      details: {
        employeeId,
        otHoursToday: summary.otHoursToday,
        otHoursThisMonth: summary.otHoursThisMonth,
        otHoursThisYear: summary.otHoursThisYear,
        dailyLimit: dailyMax,
        monthlyLimit: policy.maxOtHoursPerMonth,
        yearlyLimit: policy.maxOtHoursPerYear,
      },
    };
  }

  private toNumber(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }
}
