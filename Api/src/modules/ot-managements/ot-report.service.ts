import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { Department } from '@/entities/departments.entity';
import { OtReportQueryDto } from './dto/ot-report-query.dto';
import { vnYear } from '@/common/utils/date.util';

const DAY_TYPE_LABEL: Record<string, string> = {
  weekday: 'Weekday',
  weekday_night: 'Weekday Night',
  weekend: 'Weekend',
  weekend_night: 'Weekend Night',
  holiday: 'Holiday',
  holiday_night: 'Holiday Night',
};

const BENEFIT_LABEL: Record<string, string> = {
  paid: 'Paid OT',
  comp_leave: 'Comp Leave',
};

function toHours(minutes: number | string): number {
  return Math.round((Number(minutes) / 60) * 100) / 100;
}

@Injectable()
export class OtReportService {
  private readonly logger = new Logger(OtReportService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
  ) {}

  // ── List departments for filter dropdown ───────────────────
  async getDepartments() {
    const depts = await this.deptRepo.find({ select: ['id', 'name'], order: { name: 'ASC' } });
    return { success: true, data: depts };
  }

  // ── Check if any unconfirmed OT within the scope ───────────
  async checkHasPending(query: OtReportQueryDto): Promise<{ hasPending: boolean }> {
    const year = query.year ?? vnYear();
    const { month, departmentId } = query;

    const params: any[] = [year];
    const conditions: string[] = [
      `c.status IN ('checked_in', 'checked_out')`,
      `EXTRACT(YEAR FROM (pe.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')) = $1`,
    ];

    if (month) {
      params.push(month);
      conditions.push(`EXTRACT(MONTH FROM (pe.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')) = $${params.length}`);
    }
    if (departmentId) {
      params.push(departmentId);
      conditions.push(`plan.department_id = $${params.length}`);
    }

    const sql = `
      SELECT COUNT(*) AS cnt
      FROM ot_checkins c
        INNER JOIN ot_plan_employees pe ON pe.id = c.ot_plan_employee_id
        INNER JOIN ot_plans plan ON plan.id = pe.ot_plan_id
      WHERE ${conditions.join(' AND ')}
    `;

    const rows = await this.dataSource.query(sql, params);
    return { hasPending: parseInt(rows[0].cnt, 10) > 0 };
  }

  // ── OT Details Report ──────────────────────────────────────
  async getOtDetailsReport(query: OtReportQueryDto) {
    const year = query.year ?? vnYear();
    const { month, departmentId } = query;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const { where, params } = this.buildItemWhere(year, month, departmentId);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM ot_checkin_items item
        INNER JOIN ot_checkins c ON c.id = item.ot_checkin_id AND c.status = 'leader_approved'
        INNER JOIN ot_plan_employees pe ON pe.id = c.ot_plan_employee_id
        INNER JOIN ot_plans plan ON plan.id = pe.ot_plan_id
        INNER JOIN departments dept ON dept.id = plan.department_id
      WHERE ${where}
    `;

    const dataSql = `
      SELECT
        item.id,
        item.start_time AS "startTime",
        item.end_time   AS "endTime",
        item.duration_minutes AS "durationMinutes",
        item.day_type   AS "dayType",
        item.actual_date AS "actualDate",
        c.compensatory_method AS "compensatoryMethod",
        u.id            AS "empId",
        u.employee_id   AS "empCode",
        u.username      AS "empName",
        dept.id         AS "deptId",
        dept.name       AS "deptName"
      FROM ot_checkin_items item
        INNER JOIN ot_checkins c ON c.id = item.ot_checkin_id AND c.status = 'leader_approved'
        INNER JOIN ot_plan_employees pe ON pe.id = c.ot_plan_employee_id
        INNER JOIN ot_plans plan ON plan.id = pe.ot_plan_id
        INNER JOIN users u ON u.id = item.employee_id
        INNER JOIN departments dept ON dept.id = plan.department_id
      WHERE ${where}
      ORDER BY item.actual_date DESC, item.start_time DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(countSql, params),
      this.dataSource.query(dataSql, [...params, pageSize, offset]),
    ]);

    const total = parseInt(countRows[0].total, 10);

    const data = rows.map((r: any, idx: number) => ({
      no: offset + idx + 1,
      empCode: r.empCode,
      empName: r.empName,
      department: r.deptName,
      startTime: r.startTime,
      endTime: r.endTime,
      durationHours: toHours(r.durationMinutes),
      otType: DAY_TYPE_LABEL[r.dayType] ?? r.dayType,
      otBenefit: BENEFIT_LABEL[r.compensatoryMethod] ?? r.compensatoryMethod,
    }));

    return { success: true, data, page: { page, pageSize, total } };
  }

  // ── OT Summary Report ──────────────────────────────────────
  async getOtSummaryReport(query: OtReportQueryDto) {
    const year = query.year ?? vnYear();
    const { month, departmentId } = query;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const { where, params } = this.buildItemWhere(year, month, departmentId);

    const countSql = `
      SELECT COUNT(DISTINCT u.id) AS total
      FROM ot_checkin_items item
        INNER JOIN ot_checkins c ON c.id = item.ot_checkin_id AND c.status = 'leader_approved'
        INNER JOIN ot_plan_employees pe ON pe.id = c.ot_plan_employee_id
        INNER JOIN ot_plans plan ON plan.id = pe.ot_plan_id
        INNER JOIN users u ON u.id = item.employee_id
        INNER JOIN departments dept ON dept.id = plan.department_id
      WHERE ${where}
    `;

    const dataSql = `
      SELECT
        u.id            AS "empId",
        u.employee_id   AS "empCode",
        u.username      AS "empName",
        dept.id         AS "deptId",
        dept.name       AS "deptName",
        SUM(item.duration_minutes) AS total,
        SUM(CASE WHEN c.compensatory_method = 'comp_leave' THEN item.duration_minutes ELSE 0 END) AS comp_leave,
        SUM(CASE WHEN item.day_type = 'weekday'        AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS weekday,
        SUM(CASE WHEN item.day_type = 'weekend'        AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS weekend,
        SUM(CASE WHEN item.day_type = 'holiday'        AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS holiday,
        SUM(CASE
          WHEN item.day_type = 'weekday_night' AND c.compensatory_method = 'paid'
            AND NOT EXISTS (
              SELECT 1 FROM ot_checkin_items di
                JOIN ot_checkins dc ON dc.id = di.ot_checkin_id
                  AND dc.status = 'leader_approved' AND dc.compensatory_method = 'paid'
              WHERE di.employee_id = item.employee_id
                AND di.actual_date = item.actual_date
                AND di.day_type = 'weekday'
            )
          THEN item.duration_minutes ELSE 0 END) AS weekday_night_no_day,
        SUM(CASE
          WHEN item.day_type = 'weekday_night' AND c.compensatory_method = 'paid'
            AND EXISTS (
              SELECT 1 FROM ot_checkin_items di
                JOIN ot_checkins dc ON dc.id = di.ot_checkin_id
                  AND dc.status = 'leader_approved' AND dc.compensatory_method = 'paid'
              WHERE di.employee_id = item.employee_id
                AND di.actual_date = item.actual_date
                AND di.day_type = 'weekday'
            )
          THEN item.duration_minutes ELSE 0 END) AS weekday_night_with_day,
        SUM(CASE WHEN item.day_type = 'weekend_night'  AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS weekend_night,
        SUM(CASE WHEN item.day_type = 'holiday_night'  AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS holiday_night
      FROM ot_checkin_items item
        INNER JOIN ot_checkins c ON c.id = item.ot_checkin_id AND c.status = 'leader_approved'
        INNER JOIN ot_plan_employees pe ON pe.id = c.ot_plan_employee_id
        INNER JOIN ot_plans plan ON plan.id = pe.ot_plan_id
        INNER JOIN users u ON u.id = item.employee_id
        INNER JOIN departments dept ON dept.id = plan.department_id
      WHERE ${where}
      GROUP BY u.id, u.employee_id, u.username, dept.id, dept.name
      ORDER BY dept.name ASC, u.username ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(countSql, params),
      this.dataSource.query(dataSql, [...params, pageSize, offset]),
    ]);

    const total = parseInt(countRows[0].total, 10);

    const data = rows.map((r: any, idx: number) => ({
      no: offset + idx + 1,
      empCode: r.empCode,
      empName: r.empName,
      department: r.deptName,
      totalHours: toHours(r.total),
      compLeaveHours: toHours(r.comp_leave),
      weekdayHours: toHours(r.weekday),
      weekendHours: toHours(r.weekend),
      holidayHours: toHours(r.holiday),
      weekdayNightNoDayHours: toHours(r.weekday_night_no_day),
      weekdayNightWithDayHours: toHours(r.weekday_night_with_day),
      weekendNightHours: toHours(r.weekend_night),
      holidayNightHours: toHours(r.holiday_night),
    }));

    return { success: true, data, page: { page, pageSize, total } };
  }

  // ── Export xlsx (both sheets) ──────────────────────────────
  async exportOtReport(query: OtReportQueryDto): Promise<Buffer> {
    const year = query.year ?? vnYear();
    const { month, departmentId } = query;
    const { where, params } = this.buildItemWhere(year, month, departmentId);

    // ── Details data (all, no pagination) ─────────────────────
    const detailsSql = `
      SELECT
        item.start_time AS "startTime",
        item.end_time   AS "endTime",
        item.duration_minutes AS "durationMinutes",
        item.day_type   AS "dayType",
        c.compensatory_method AS "compensatoryMethod",
        u.employee_id   AS "empCode",
        u.username      AS "empName",
        dept.name       AS "deptName"
      FROM ot_checkin_items item
        INNER JOIN ot_checkins c ON c.id = item.ot_checkin_id AND c.status = 'leader_approved'
        INNER JOIN ot_plan_employees pe ON pe.id = c.ot_plan_employee_id
        INNER JOIN ot_plans plan ON plan.id = pe.ot_plan_id
        INNER JOIN users u ON u.id = item.employee_id
        INNER JOIN departments dept ON dept.id = plan.department_id
      WHERE ${where}
      ORDER BY item.actual_date DESC, item.start_time DESC
    `;

    // ── Summary data (all, no pagination) ─────────────────────
    const summarySql = `
      SELECT
        u.employee_id   AS "empCode",
        u.username      AS "empName",
        dept.name       AS "deptName",
        SUM(item.duration_minutes) AS total,
        SUM(CASE WHEN c.compensatory_method = 'comp_leave' THEN item.duration_minutes ELSE 0 END) AS comp_leave,
        SUM(CASE WHEN item.day_type = 'weekday'       AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS weekday,
        SUM(CASE WHEN item.day_type = 'weekend'       AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS weekend,
        SUM(CASE WHEN item.day_type = 'holiday'       AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS holiday,
        SUM(CASE
          WHEN item.day_type = 'weekday_night' AND c.compensatory_method = 'paid'
            AND NOT EXISTS (
              SELECT 1 FROM ot_checkin_items di
                JOIN ot_checkins dc ON dc.id = di.ot_checkin_id
                  AND dc.status = 'leader_approved' AND dc.compensatory_method = 'paid'
              WHERE di.employee_id = item.employee_id AND di.actual_date = item.actual_date AND di.day_type = 'weekday'
            )
          THEN item.duration_minutes ELSE 0 END) AS weekday_night_no_day,
        SUM(CASE
          WHEN item.day_type = 'weekday_night' AND c.compensatory_method = 'paid'
            AND EXISTS (
              SELECT 1 FROM ot_checkin_items di
                JOIN ot_checkins dc ON dc.id = di.ot_checkin_id
                  AND dc.status = 'leader_approved' AND dc.compensatory_method = 'paid'
              WHERE di.employee_id = item.employee_id AND di.actual_date = item.actual_date AND di.day_type = 'weekday'
            )
          THEN item.duration_minutes ELSE 0 END) AS weekday_night_with_day,
        SUM(CASE WHEN item.day_type = 'weekend_night' AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS weekend_night,
        SUM(CASE WHEN item.day_type = 'holiday_night' AND c.compensatory_method = 'paid' THEN item.duration_minutes ELSE 0 END) AS holiday_night
      FROM ot_checkin_items item
        INNER JOIN ot_checkins c ON c.id = item.ot_checkin_id AND c.status = 'leader_approved'
        INNER JOIN ot_plan_employees pe ON pe.id = c.ot_plan_employee_id
        INNER JOIN ot_plans plan ON plan.id = pe.ot_plan_id
        INNER JOIN users u ON u.id = item.employee_id
        INNER JOIN departments dept ON dept.id = plan.department_id
      WHERE ${where}
      GROUP BY u.id, u.employee_id, u.username, dept.id, dept.name
      ORDER BY dept.name ASC, u.username ASC
    `;

    const [detailRows, summaryRows] = await Promise.all([
      this.dataSource.query(detailsSql, params),
      this.dataSource.query(summarySql, params),
    ]);

    const wb = XLSX.utils.book_new();

    // Sheet 1: OT Details
    const VN_TZ = 'Asia/Ho_Chi_Minh';
    const detailsHeader = [
      'No.', 'Employee ID', 'Full Name', 'Department',
      'Start Time', 'End Time', 'Duration (h)', 'OT Type', 'OT Benefit',
    ];
    const detailsAoa = [
      detailsHeader,
      ...detailRows.map((r: any, i: number) => {
        const start = new Date(r.startTime);
        const end = new Date(r.endTime);
        const fmtOpts: Intl.DateTimeFormatOptions = {
          timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        };
        return [
          i + 1,
          r.empCode ?? '',
          r.empName ?? '',
          r.deptName ?? '',
          start.toLocaleString('vi-VN', fmtOpts),
          end.toLocaleString('vi-VN', fmtOpts),
          toHours(r.durationMinutes),
          DAY_TYPE_LABEL[r.dayType] ?? r.dayType,
          BENEFIT_LABEL[r.compensatoryMethod] ?? r.compensatoryMethod,
        ];
      }),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailsAoa), 'OT Details');

    // Sheet 2: OT Summary
    const summaryHeader = [
      'No.', 'Employee ID', 'Full Name', 'Department',
      'Total (h)', 'Comp Leave (h)',
      'Weekday', 'Weekend', 'Holiday',
      'Weekday Night (No day OT)', 'Weekday Night (With day OT)',
      'Weekend Night', 'Holiday Night',
    ];
    const summaryAoa = [
      summaryHeader,
      ...summaryRows.map((r: any, i: number) => [
        i + 1,
        r.empCode ?? '',
        r.empName ?? '',
        r.deptName ?? '',
        toHours(r.total),
        toHours(r.comp_leave),
        toHours(r.weekday),
        toHours(r.weekend),
        toHours(r.holiday),
        toHours(r.weekday_night_no_day),
        toHours(r.weekday_night_with_day),
        toHours(r.weekend_night),
        toHours(r.holiday_night),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), 'OT Summary');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf);
  }

  // ── Private: build WHERE clause for ot_checkin_items ───────
  private buildItemWhere(year: number, month?: number, departmentId?: number) {
    const conditions: string[] = [];
    const params: any[] = [];

    params.push(year);
    conditions.push(`EXTRACT(YEAR FROM item.actual_date) = $${params.length}`);

    if (month) {
      params.push(month);
      conditions.push(`EXTRACT(MONTH FROM item.actual_date) = $${params.length}`);
    }
    if (departmentId) {
      params.push(departmentId);
      conditions.push(`plan.department_id = $${params.length}`);
    }

    return { where: conditions.join(' AND '), params };
  }
}
