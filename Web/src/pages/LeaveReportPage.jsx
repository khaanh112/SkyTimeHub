import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { LoadingSpinner } from '../components';
import { toast } from 'react-toastify';
import { Download, ArrowLeft, AlertCircle } from 'lucide-react';
import { vnYear, fmtDate } from '../utils/date';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONTRACT_LABELS = {
  intern:     'Internship',
  probation:  'Probation',
  official:   'Official',
};

const MONTHS = [
  { value: '', label: 'All months' },
  { value: '1',  label: 'January' },   { value: '2',  label: 'February' },
  { value: '3',  label: 'March' },     { value: '4',  label: 'April' },
  { value: '5',  label: 'May' },       { value: '6',  label: 'June' },
  { value: '7',  label: 'July' },      { value: '8',  label: 'August' },
  { value: '9',  label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' },  { value: '12', label: 'December' },
];

const DEPT_NAME_MAP = {
  HR_ADMIN:          'HR & Admin',
  ACCOUNTING:        'Accounting',
  EMAIL_SERVICE:     'Email Service',
  RND_CENTER:        'R&D Center',
  MARKETING:         'Marketing',
  SALES_SUPPORT:     'Sales Support',
  SALES_SOLUTION:    'Sales Solution',
  FULFILLMENT:       'Fulfillment',
  TECH_SUPPORT:      'Tech Support',
  TECH_DEV_CENTER:   'Tech Dev Center',
  EXECUTIVE_OFFICE:  'Executive Office',
};

const deptDisplayName = (name) => DEPT_NAME_MAP[name] ?? name;

const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(1));

// Build a range of years [current-4 … current+1]
const currentYear = vnYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i).filter((y) => y <= currentYear + 1);

// ── Cell component for leave columns (null → "–") ─────────────────────────
const Num = ({ value }) =>
  value === null ? (
    <span className="text-gray-400">—</span>
  ) : (
    <span>{Number(value).toFixed(1)}</span>
  );

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaveReportPage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    year:         String(vnYear()),
    month:        '',
    departmentId: '',
  });
  const [reportData, setReportData]       = useState(null);  // { rows, hasPending }
  const [loading, setLoading]             = useState(false);
  const [exporting, setExporting]         = useState(false);

  // Load department list once
  useEffect(() => {
    leaveRequestService.getReportDepartments()
      .then((res) => setDepartments(res.data || res || []))
      .catch(() => {/* non-critical */});
  }, []);

  // Fetch report whenever filters change
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year: filters.year };
      if (filters.month)        params.month        = filters.month;
      if (filters.departmentId) params.departmentId = filters.departmentId;

      const res = await leaveRequestService.getLeaveReport(params);
      setReportData(res?.data || res);
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Failed to load report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    if (!reportData || reportData.hasPending) return;
    setExporting(true);
    try {
      const params = { year: filters.year };
      if (filters.month)        params.month        = filters.month;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      await leaveRequestService.exportLeaveReport(params);
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const rows = reportData?.rows ?? [];
  const hasPending = reportData?.hasPending ?? false;

  return (
    <div className="min-w-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/leave-requests')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Leave Days Report</h1>
        </div>

        <div className="relative group">
          <button
            onClick={handleExport}
            disabled={exporting || loading || hasPending}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              hasPending
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {exporting ? <LoadingSpinner size="sm" /> : <Download className="w-4 h-4" />}
            Export Excel
          </button>
          {hasPending && (
            <div className="absolute right-0 top-full mt-1.5 z-10 w-72 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg hidden group-hover:block">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>Cannot export. There are pending leave requests in the selected period. Please approve or reject them first.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 mb-5 bg-white border border-gray-200 rounded-xl px-5 py-4">
        {/* Department */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Department</label>
          <select
            value={filters.departmentId}
            onChange={(e) => handleFilterChange('departmentId', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {deptDisplayName(d.name)}
              </option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Year</label>
          <select
            value={filters.year}
            onChange={(e) => handleFilterChange('year', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px]"
          >
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Month</label>
          <select
            value={filters.month}
            onChange={(e) => handleFilterChange('month', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {hasPending && (
          <div className="flex items-center gap-2 text-amber-600 text-sm ml-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>There are pending requests — export is disabled.</span>
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-base font-medium">No leave records found for the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm border-collapse">
              <thead>
                {/* Row 1 – group headers */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th rowSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap w-10">No.</th>
                  <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">Employee ID</th>
                  <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">Full Name</th>
                  <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">Department</th>
                  <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">Join Date</th>
                  <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">Contract Signed</th>
                  <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">Contract</th>
                  <th colSpan={3} className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider border-r border-gray-200 bg-blue-50/60">Paid Leave</th>
                  <th colSpan={3} className="px-3 py-2.5 text-center text-xs font-semibold text-orange-600 uppercase tracking-wider border-r border-gray-200 bg-orange-50/60">Unpaid Leave</th>
                  <th rowSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-purple-600 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap bg-purple-50/40">Policy<br/>Leave</th>
                  <th rowSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider whitespace-nowrap bg-teal-50/40">Social<br/>Benefits</th>
                </tr>
                {/* Row 2 – sub-headers */}
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-center text-xs font-medium text-blue-500 border-r border-gray-100 whitespace-nowrap bg-blue-50/40">Total</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-blue-500 border-r border-gray-100 whitespace-nowrap bg-blue-50/40">Used</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-blue-500 border-r border-gray-200 whitespace-nowrap bg-blue-50/40">Remaining</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-orange-500 border-r border-gray-100 whitespace-nowrap bg-orange-50/40">Total</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-orange-500 border-r border-gray-100 whitespace-nowrap bg-orange-50/40">Used</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-orange-500 border-r border-gray-200 whitespace-nowrap bg-orange-50/40">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.userId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-3 text-center text-gray-400 text-xs border-r border-gray-100">{row.no}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-600 border-r border-gray-100 whitespace-nowrap">{row.employeeId || '—'}</td>
                    <td className="px-3 py-3 text-gray-900 font-medium border-r border-gray-100 whitespace-nowrap">{row.fullName}</td>
                    <td className="px-3 py-3 text-gray-600 border-r border-gray-100 whitespace-nowrap text-xs">{deptDisplayName(row.department)}</td>
                    <td className="px-3 py-3 text-gray-600 border-r border-gray-100 whitespace-nowrap text-xs">
                      {row.joinDate ? fmtDate(row.joinDate) : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 border-r border-gray-100 whitespace-nowrap text-xs">
                      {row.contractSignedDate ? fmtDate(row.contractSignedDate) : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 border-r border-gray-100 whitespace-nowrap text-xs">
                      {row.contractType ? (CONTRACT_LABELS[row.contractType] ?? row.contractType) : '—'}
                    </td>
                    {/* Paid Leave */}
                    <td className="px-3 py-3 text-center border-r border-gray-100 bg-blue-50/20"><Num value={row.paidLeaveTotal} /></td>
                    <td className="px-3 py-3 text-center border-r border-gray-100 bg-blue-50/20"><Num value={row.paidLeaveUsed} /></td>
                    <td className="px-3 py-3 text-center border-r border-gray-200 bg-blue-50/20"><Num value={row.paidLeaveRemaining} /></td>
                    {/* Unpaid Leave */}
                    <td className="px-3 py-3 text-center border-r border-gray-100 bg-orange-50/20"><Num value={row.unpaidLeaveTotal} /></td>
                    <td className="px-3 py-3 text-center border-r border-gray-100 bg-orange-50/20">{Number(row.unpaidLeaveUsed).toFixed(1)}</td>
                    <td className="px-3 py-3 text-center border-r border-gray-200 bg-orange-50/20"><Num value={row.unpaidLeaveRemaining} /></td>
                    {/* Policy & Social */}
                    <td className="px-3 py-3 text-center border-r border-gray-100 bg-purple-50/20">{Number(row.policyLeaveUsed).toFixed(1)}</td>
                    <td className="px-3 py-3 text-center bg-teal-50/20">{Number(row.socialLeaveUsed).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      {!loading && rows.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          "—" in Paid/Unpaid Leave Total &amp; Remaining indicates Internship or Probation employees who don't have an annual leave allocation.
          {hasPending && ' Export is disabled while there are pending requests.'}
        </p>
      )}
    </div>
  );
}
