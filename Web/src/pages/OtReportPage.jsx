import { useState, useEffect, useCallback } from 'react';
import { fmtDateTime, vnYear } from '../utils/date';
import otService from '../services/otService';

const MONTHS = [
  { value: '', label: 'All months' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Month ${i + 1}` })),
];

const CURRENT_YEAR = vnYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export default function OtReportPage() {
  const [activeTab, setActiveTab] = useState('details');

  // Filters
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  // Data
  const [departments, setDepartments] = useState([]);
  const [detailsData, setDetailsData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [detailsPage, setDetailsPage] = useState({ page: 1, pageSize: 10, total: 0 });
  const [summaryPage, setSummaryPage] = useState({ page: 1, pageSize: 10, total: 0 });
  const [hasPending, setHasPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load departments once
  useEffect(() => {
    otService.getReportDepartments().then((res) => setDepartments(res.data ?? []));
  }, []);

  const fetchHasPending = useCallback(async () => {
    const res = await otService.getOtReportHasPending({
      year,
      month: month || undefined,
      departmentId: departmentId || undefined,
    });
    setHasPending(res.hasPending ?? false);
  }, [year, month, departmentId]);

  const fetchDetails = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await otService.getOtDetailsReport({
          year,
          month: month || undefined,
          departmentId: departmentId || undefined,
          page,
          pageSize: detailsPage.pageSize,
        });
        setDetailsData(res.data ?? []);
        if (res.page) setDetailsPage((p) => ({ ...p, ...res.page }));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, month, departmentId],
  );

  const fetchSummary = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await otService.getOtSummaryReport({
          year,
          month: month || undefined,
          departmentId: departmentId || undefined,
          page,
          pageSize: summaryPage.pageSize,
        });
        setSummaryData(res.data ?? []);
        if (res.page) setSummaryPage((p) => ({ ...p, ...res.page }));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, month, departmentId],
  );

  // Re-fetch when filters change
  useEffect(() => {
    fetchHasPending();
    if (activeTab === 'details') fetchDetails(1);
    else fetchSummary(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, departmentId]);

  // Re-fetch when tab switches
  useEffect(() => {
    if (activeTab === 'details') fetchDetails(1);
    else fetchSummary(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleExport = async () => {
    if (hasPending || exporting) return;
    setExporting(true);
    try {
      await otService.exportOtReport({
        year,
        month: month || undefined,
        departmentId: departmentId || undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  const totalPages = (pd) => Math.ceil(pd.total / pd.pageSize) || 1;

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">OT Hours Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            Actual confirmed OT hours breakdown by employee
          </p>
        </div>

        {/* Export button */}
        <div className="relative group">
          <button
            onClick={handleExport}
            disabled={hasPending || exporting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
              ${hasPending || exporting
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting…' : 'Export xlsx'}
          </button>
          {hasPending && (
            <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block w-72
              bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
              Export is disabled because there are unconfirmed OT check-outs in this period.
              Please confirm or reject all pending records first.
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4 items-end">
        {/* Department */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-slate-600">Department</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { key: 'details', label: 'OT Details' },
          { key: 'summary', label: 'OT Summary' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table area */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        ) : activeTab === 'details' ? (
          <DetailsTable
            data={detailsData}
            page={detailsPage}
            totalPages={totalPages(detailsPage)}
            onPageChange={(p) => {
              setDetailsPage((prev) => ({ ...prev, page: p }));
              fetchDetails(p);
            }}
          />
        ) : (
          <SummaryTable
            data={summaryData}
            page={summaryPage}
            totalPages={totalPages(summaryPage)}
            onPageChange={(p) => {
              setSummaryPage((prev) => ({ ...prev, page: p }));
              fetchSummary(p);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Details Table ────────────────────────────────────────────

function DetailsTable({ data, page, totalPages, onPageChange }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['No.', 'Employee ID', 'Full Name', 'Department',
                'Start Time', 'End Time', 'Duration (h)', 'OT Type', 'OT Benefit'
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-slate-400">
                  No OT records found for the selected criteria.
                </td>
              </tr>
            ) : data.map((row) => (
              <tr key={row.no} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{row.no}</td>
                <td className="px-4 py-3 text-slate-700 font-mono text-xs">{row.empCode ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.empName}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.department}</td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmtDateTime(row.startTime)}</td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmtDateTime(row.endTime)}</td>
                <td className="px-4 py-3 text-slate-900 font-semibold text-right pr-6">
                  {row.durationHours.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <OtTypeBadge type={row.otType} />
                </td>
                <td className="px-4 py-3">
                  <BenefitBadge benefit={row.otBenefit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page.page} totalPages={totalPages} total={page.total} onPageChange={onPageChange} />
    </div>
  );
}

// ── Summary Table ────────────────────────────────────────────

function SummaryTable({ data, page, totalPages, onPageChange }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">No.</th>
              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Employee ID</th>
              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Full Name</th>
              <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Department</th>
              <th rowSpan={2} className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">Total (h)</th>
              <th rowSpan={2} className="px-4 py-3 text-right text-xs font-semibold text-blue-600 whitespace-nowrap border-r border-slate-200">Comp Leave (h)</th>
              <th colSpan={7} className="px-4 py-2 text-center text-xs font-semibold text-emerald-700 bg-emerald-50 border-b border-slate-200">
                Paid OT (hours)
              </th>
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200">
              {[
                'Weekday', 'Weekend', 'Holiday',
                'Wkday Night\n(No day OT)', 'Wkday Night\n(With day OT)',
                'Weekend Night', 'Holiday Night',
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-emerald-700 whitespace-pre bg-emerald-50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-16 text-slate-400">
                  No OT records found for the selected criteria.
                </td>
              </tr>
            ) : data.map((row) => (
              <tr key={row.no} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 border-r border-slate-100">{row.no}</td>
                <td className="px-4 py-3 text-slate-700 font-mono text-xs border-r border-slate-100">{row.empCode ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap border-r border-slate-100">{row.empName}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap border-r border-slate-100">{row.department}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900 border-r border-slate-100">{row.totalHours.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700 border-r border-slate-100">{row.compLeaveHours.toFixed(2)}</td>
                <Num value={row.weekdayHours} />
                <Num value={row.weekendHours} />
                <Num value={row.holidayHours} />
                <Num value={row.weekdayNightNoDayHours} />
                <Num value={row.weekdayNightWithDayHours} />
                <Num value={row.weekendNightHours} />
                <Num value={row.holidayNightHours} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page.page} totalPages={totalPages} total={page.total} onPageChange={onPageChange} />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function Num({ value }) {
  return (
    <td className="px-3 py-3 text-right text-slate-700">
      {value > 0 ? value.toFixed(2) : <span className="text-slate-300">—</span>}
    </td>
  );
}

function OtTypeBadge({ type }) {
  const map = {
    'Weekday': 'bg-blue-50 text-blue-700',
    'Weekday Night': 'bg-indigo-50 text-indigo-700',
    'Weekend': 'bg-amber-50 text-amber-700',
    'Weekend Night': 'bg-orange-50 text-orange-700',
    'Holiday': 'bg-rose-50 text-rose-700',
    'Holiday Night': 'bg-purple-50 text-purple-700',
  };
  const cls = map[type] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {type}
    </span>
  );
}

function BenefitBadge({ benefit }) {
  const cls = benefit === 'Comp Leave'
    ? 'bg-blue-50 text-blue-700'
    : 'bg-emerald-50 text-emerald-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {benefit}
    </span>
  );
}

function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1 && total === 0) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
      <span className="text-sm text-slate-500">
        Total: <strong className="text-slate-700">{total}</strong> record(s)
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
        >
          ← Prev
        </button>
        <span className="text-sm text-slate-600">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
