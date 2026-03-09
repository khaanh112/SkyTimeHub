import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '@/entities/system-setting.entity';
import { OtPolicyDto, OtPolicyResponseDto } from '../dto/ot-policy.dto';
import { LeavePolicyDto, LeavePolicyResponseDto } from '../dto/leave-policy.dto';

/** Default values applied when no DB row exists yet */
const OT_POLICY_DEFAULTS: OtPolicyResponseDto = {
  maxOtHoursPerDay: 4,
  maxOtHoursPerDayHoliday: 8,
  maxOtHoursPerMonth: 40,
  maxOtHoursPerYear: 200,
};

const LEAVE_POLICY_DEFAULTS: LeavePolicyResponseDto = {
  minCompLeaveDurationHours: 4,
};

const CATEGORY_OT = 'ot_policy';
const CATEGORY_LEAVE = 'leave_policy';

@Injectable()
export class PolicySettingsService {
  private readonly logger = new Logger(PolicySettingsService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
  ) {}

  // ── OT Policy ──────────────────────────────────────────────

  async getOtPolicy(): Promise<OtPolicyResponseDto> {
    const rows = await this.settingRepo.find({ where: { category: CATEGORY_OT } });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      maxOtHoursPerDay: this.toNumber(
        map.get('max_ot_hours_per_day'),
        OT_POLICY_DEFAULTS.maxOtHoursPerDay,
      ),
      maxOtHoursPerDayHoliday: this.toNumber(
        map.get('max_ot_hours_per_day_holiday'),
        OT_POLICY_DEFAULTS.maxOtHoursPerDayHoliday,
      ),
      maxOtHoursPerMonth: this.toNumber(
        map.get('max_ot_hours_per_month'),
        OT_POLICY_DEFAULTS.maxOtHoursPerMonth,
      ),
      maxOtHoursPerYear: this.toNumber(
        map.get('max_ot_hours_per_year'),
        OT_POLICY_DEFAULTS.maxOtHoursPerYear,
      ),
    };
  }

  async saveOtPolicy(dto: OtPolicyDto): Promise<OtPolicyResponseDto> {
    this.logger.log('Saving OT policy settings');

    const entries: { key: string; value: string; description: string }[] = [
      {
        key: 'max_ot_hours_per_day',
        value: String(dto.maxOtHoursPerDay),
        description: 'Max OT hours per day (regular days)',
      },
      {
        key: 'max_ot_hours_per_day_holiday',
        value: String(dto.maxOtHoursPerDayHoliday),
        description: 'Max OT hours per day (rest days & holidays)',
      },
      {
        key: 'max_ot_hours_per_month',
        value: String(dto.maxOtHoursPerMonth),
        description: 'Max OT hours per month',
      },
      {
        key: 'max_ot_hours_per_year',
        value: String(dto.maxOtHoursPerYear),
        description: 'Max OT hours per year',
      },
    ];

    await this.upsertSettings(CATEGORY_OT, entries);
    return this.getOtPolicy();
  }

  // ── Leave Policy ───────────────────────────────────────────

  async getLeavePolicy(): Promise<LeavePolicyResponseDto> {
    const rows = await this.settingRepo.find({ where: { category: CATEGORY_LEAVE } });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      minCompLeaveDurationHours: this.toNumber(
        map.get('min_comp_leave_duration_hours'),
        LEAVE_POLICY_DEFAULTS.minCompLeaveDurationHours,
      ),
    };
  }

  async saveLeavePolicy(dto: LeavePolicyDto): Promise<LeavePolicyResponseDto> {
    this.logger.log('Saving leave policy settings');

    const entries: { key: string; value: string; description: string }[] = [
      {
        key: 'min_comp_leave_duration_hours',
        value: String(dto.minCompLeaveDurationHours),
        description: 'Min compensatory leave duration per request (hours)',
      },
    ];

    await this.upsertSettings(CATEGORY_LEAVE, entries);
    return this.getLeavePolicy();
  }

  // ── Helpers ────────────────────────────────────────────────

  private async upsertSettings(
    category: string,
    entries: { key: string; value: string; description: string }[],
  ): Promise<void> {
    for (const entry of entries) {
      const existing = await this.settingRepo.findOne({ where: { key: entry.key } });
      if (existing) {
        existing.value = entry.value;
        existing.description = entry.description;
        await this.settingRepo.save(existing);
      } else {
        const entity = this.settingRepo.create({
          category,
          key: entry.key,
          value: entry.value,
          description: entry.description,
        });
        await this.settingRepo.save(entity);
      }
    }
  }

  private toNumber(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }
}
