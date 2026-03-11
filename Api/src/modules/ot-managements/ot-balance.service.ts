import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtBalanceTransaction } from '@/entities/ot-balance-transaction.entity';
import { SystemSetting } from '@/entities/system-setting.entity';

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

  async getEmployeeSummary(employeeId: number, referenceDate?: Date): Promise<EmployeeOtSummary> {
    const now = referenceDate || new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dateStr = now.toISOString().slice(0, 10);

    // Daily hours
    const dailyResult = await this.otBalanceRepo
      .createQueryBuilder('t')
      .select(
        "COALESCE(SUM(CASE WHEN t.direction = OtBalanceDirection.CREDIT THEN t.amount_minutes ELSE -t.amount_minutes END), 0)",
        'minutes',
      )
      .where('t.employee_id = :employeeId', { employeeId })
      .andWhere('t.period_date = :dateStr', { dateStr })
      .getRawOne();

    // Monthly hours
    const monthlyResult = await this.otBalanceRepo
      .createQueryBuilder('t')
      .select(
        "COALESCE(SUM(CASE WHEN t.direction = OtBalanceDirection.CREDIT THEN t.amount_minutes ELSE -t.amount_minutes END), 0)",
        'minutes',
      )
      .where('t.employee_id = :employeeId', { employeeId })
      .andWhere('t.period_year = :year', { year })
      .andWhere('t.period_month = :month', { month })
      .getRawOne();

    // Yearly hours
    const yearlyResult = await this.otBalanceRepo
      .createQueryBuilder('t')
      .select(
        "COALESCE(SUM(CASE WHEN t.direction = OtBalanceDirection.CREDIT THEN t.amount_minutes ELSE -t.amount_minutes END), 0)",
        'minutes',
      )
      .where('t.employee_id = :employeeId', { employeeId })
      .andWhere('t.period_year = :year', { year })
      .getRawOne();

    return {
      employeeId,
      otHoursToday: Math.round(((Number(dailyResult?.minutes) || 0) / 60) * 10) / 10,
      otHoursThisMonth: Math.round(((Number(monthlyResult?.minutes) || 0) / 60) * 10) / 10,
      otHoursThisYear: Math.round(((Number(yearlyResult?.minutes) || 0) / 60) * 10) / 10,
    };
  }

  async validateOtLimits(
    employeeId: number,
    date: Date,
    additionalMinutes: number,
    isHoliday: boolean,
  ): Promise<{ valid: boolean; violations: string[] }> {
    const policy = await this.getOtPolicy();
    const summary = await this.getEmployeeSummary(employeeId, date);
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

    return { valid: violations.length === 0, violations };
  }

  private toNumber(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }
}
