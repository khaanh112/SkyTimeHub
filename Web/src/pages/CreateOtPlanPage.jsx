import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { otService, userService } from '../services';
import { LoadingSpinner, DateTimePicker } from '../components';
import { useAuth } from '../context';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  ChevronDown,
  Clock,
  Info,
} from 'lucide-react';

// ── Employee Dropdown ────────────────────────────────────────────────

const EmployeeSelector = ({ value, users, onChange, excludeIds }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = users.filter(
    (u) =>
      !excludeIds.includes(u.id) &&
      (u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = users.find((u) => u.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors min-h-[46px]"
      >
        {selected ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {selected.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-gray-900 truncate">{selected.username}</div>
              {selected.email && <div className="text-xs text-gray-400 truncate">{selected.email}</div>}
            </div>
          </div>
        ) : (
          <span className="text-gray-400">Search by Name or Email...</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name or Email..."
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">No employees found</div>
          ) : (
            filtered.map((u) => (
              <div
                key={u.id}
                className="px-3 py-2.5 cursor-pointer hover:bg-gray-50 text-sm text-gray-700"
                onClick={() => { onChange(u.id); setIsOpen(false); setSearch(''); }}
              >
                <span>{u.username} <span className="text-gray-400 text-xs">({u.email})</span></span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── OT Summary Tooltip ───────────────────────────────────────────────

const EmployeeOtTooltip = ({ employeeId }) => {
  const [show, setShow] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEnter = async () => {
    setShow(true);
    if (summary !== null) return;
    setLoading(true);
    try {
      const data = await otService.getEmployeeOtSummary(employeeId);
      setSummary(data);
    } catch {
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex-shrink-0" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      <Info className="w-4 h-4 text-gray-400 hover:text-blue-500 cursor-pointer transition-colors" />
      {show && (
        <div className="absolute left-6 top-0 z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg w-52 pointer-events-none">
          <div className="font-semibold mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> OT Summary
          </div>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-gray-300">OT hours today:</span>
                <span className="font-medium">{summary?.otHoursToday ?? 0}h</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-300">OT hours this month:</span>
                <span className="font-medium">{summary?.otHoursThisMonth ?? 0}h</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-300">OT hours this year:</span>
                <span className="font-medium">{summary?.otHoursThisYear ?? 0}h</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Duration Helper ───────────────────────────────────────────────────

const calcDurationMinutes = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  const s = new Date(startTime);
  const e = new Date(endTime);
  const diff = Math.round((e - s) / (1000 * 60));
  return diff > 0 ? diff : null;
};

const fmtMinutes = (minutes) => {
  if (minutes == null || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

// ── Limit Exceeded Dialog (AC-03) ────────────────────────────────────

const LimitExceededDialog = ({ violations, onCancel, onConfirm, submitting }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
      <div className="px-6 py-4 border-b border-amber-200 bg-amber-50 rounded-t-xl flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <h2 className="text-lg font-semibold text-amber-900">OT Limit Exceeded</h2>
      </div>
      <div className="p-6 overflow-y-auto">
        <p className="text-sm text-gray-600 mb-4">
          One or more employees in your OT plan have exceeded their allowed OT limits. Review the
          details below and confirm if you wish to proceed.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-3 py-2 text-right">Today</th>
                <th className="px-3 py-2 text-right">This Month</th>
                <th className="px-3 py-2 text-right">This Year</th>
                <th className="px-3 py-2 text-right">New OT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {violations.map((v) => (
                <tr key={v.employeeName}>
                  <td className="px-3 py-3 font-medium text-gray-900">
                    <div>{v.employeeName}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {v.violations.map((msg, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          {msg.split(':')[0]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600 whitespace-nowrap">
                    {v.otHoursToday}h / {v.dailyLimit}h
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600 whitespace-nowrap">
                    {v.otHoursThisMonth}h / {v.monthlyLimit}h
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600 whitespace-nowrap">
                    {v.otHoursThisYear}h / {v.yearlyLimit}h
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                    +{v.plannedHours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            'Confirm & Submit'
          )}
        </button>
      </div>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────

const CreateOtPlanPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [balanceViolations, setBalanceViolations] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const [employees, setEmployees] = useState([
    { key: 1, employeeId: null, startTime: '', endTime: '', plannedTask: '' },
  ]);
  const nextKey = useRef(2);

  // Load users belonging to the current user's department
  useEffect(() => {
    (async () => {
      try {
        setLoadingUsers(true);
        const res = await userService.getAll();
        const allUsers = Array.isArray(res) ? res : res.data || [];
        const deptUsers = currentUser?.departmentId
          ? allUsers.filter((u) => u.departmentId === currentUser.departmentId)
          : allUsers;
        setUsers(deptUsers);
      } catch {
        toast.error('Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [currentUser?.departmentId]);

  // Compute total duration across all rows
  const totalMinutes = employees.reduce((sum, e) => {
    const d = calcDurationMinutes(e.startTime, e.endTime);
    return sum + (d || 0);
  }, 0);

  const addEmployee = () => {
    setEmployees((prev) => [
      ...prev,
      { key: nextKey.current++, employeeId: null, startTime: '', endTime: '', plannedTask: '' },
    ]);
  };

  const removeEmployee = (key) => {
    setEmployees((prev) => prev.filter((e) => e.key !== key));
  };

  const updateEmployee = (key, field, value) => {
    setEmployees((prev) => prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)));
  };

  const isFormValid =
    formData.title.trim().length > 0 &&
    employees.length > 0 &&
    employees.every(
      (e) =>
        e.employeeId &&
        e.startTime &&
        e.endTime &&
        new Date(e.endTime) > new Date(e.startTime) &&
        e.plannedTask.trim().length > 0,
    );

  const buildPayload = (acknowledge = false) => {
    // Group flat rows by employeeId into the nested API shape
    const empMap = new Map();
    for (const row of employees) {
      if (!empMap.has(row.employeeId)) empMap.set(row.employeeId, { employeeId: row.employeeId, tasks: [] });
      empMap.get(row.employeeId).tasks.push({
        startTime: `${row.startTime}:00+07:00`,
        endTime: `${row.endTime}:00+07:00`,
        plannedTask: row.plannedTask.trim(),
      });
    }
    return {
      title: formData.title.trim(),
      description: formData.description?.trim() || undefined,
      acknowledgeBalanceExceeded: acknowledge,
      employees: [...empMap.values()],
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || formData.title.trim().length < 1) {
      toast.error('Title is required');
      return;
    }

    for (let i = 0; i < employees.length; i++) {
      const row = employees[i];
      if (!row.employeeId) {
        toast.error(`Row ${i + 1}: Please select an employee`);
        return;
      }
      if (!row.startTime || !row.endTime) {
        toast.error(`Row ${i + 1}: Start and end times are required`);
        return;
      }
      if (new Date(row.endTime) <= new Date(row.startTime)) {
        toast.error(`Row ${i + 1}: End time must be after start time`);
        return;
      }
      if (!row.plannedTask || row.plannedTask.trim().length < 1) {
        toast.error(`Row ${i + 1}: Planned task is required`);
        return;
      }
    }

    try {
      setSubmitting(true);
      await otService.createOtPlan(buildPayload());
      toast.success('OT plan submitted successfully!');
      navigate('/ot-management');
    } catch (error) {
      const data = error.response?.data;
      if (data?.code === 'BALANCE_EXCEEDED' && Array.isArray(data?.details) && data.details.length > 0) {
        setBalanceViolations(data.details);
      } else if (data?.details?.length) {
        data.details.forEach((m) => toast.error(m));
      } else {
        toast.error(data?.message || 'Failed to create OT plan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOverride = async () => {
    try {
      setSubmitting(true);
      await otService.createOtPlan(buildPayload(true));
      toast.success('OT plan submitted successfully!');
      navigate('/ot-management');
    } catch (error) {
      const data = error.response?.data;
      if (data?.details?.length) {
        data.details.forEach((m) => toast.error(m));
      } else {
        toast.error(data?.message || 'Failed to create OT plan');
      }
      setBalanceViolations(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {balanceViolations && (
        <LimitExceededDialog
          violations={balanceViolations}
          onCancel={() => setBalanceViolations(null)}
          onConfirm={handleConfirmOverride}
          submitting={submitting}
        />
      )}
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/ot-management')}
          className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to OT Management</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create OT Plan</h1>
        <p className="text-sm text-gray-600 mt-1">Plan overtime work for your team members</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Card 1: General Information ────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">1</div>
              <h3 className="text-base font-semibold text-gray-900">General Information</h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Weekend deployment March 2026"
                  maxLength={100}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Duration</label>
                <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {totalMinutes > 0 ? fmtMinutes(totalMinutes) : 'Auto-calculated from employees'}
                </div>
                <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Sum of all employee durations
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Employee Details ─────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">2</div>
              <h3 className="text-base font-semibold text-gray-900">Employee Details</h3>
              <span className="text-xs text-gray-500">({employees.length} row{employees.length > 1 ? 's' : ''})</span>
            </div>
            <button
              type="button"
              onClick={addEmployee}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Employee
            </button>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[5%]">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[24%]">Employee Info <span className="text-red-500">*</span></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%]">Start <span className="text-red-500">*</span></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%]">End <span className="text-red-500">*</span></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[8%]">Duration</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Task <span className="text-red-500">*</span></th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-[5%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp, idx) => {
                    const dur = calcDurationMinutes(emp.startTime, emp.endTime);
                    return (
                      <tr key={emp.key} className="hover:bg-gray-50/50">
                        <td className="px-3 py-3 text-sm text-gray-500 font-medium">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 min-w-0">
                              {loadingUsers ? (
                                <div className="text-sm text-gray-400">Loading...</div>
                              ) : (
                                <EmployeeSelector
                                  value={emp.employeeId}
                                  users={users}
                                  onChange={(id) => updateEmployee(emp.key, 'employeeId', id)}
                                  excludeIds={[]}
                                />
                              )}
                            </div>
                            {emp.employeeId && (
                              <EmployeeOtTooltip key={emp.employeeId} employeeId={emp.employeeId} />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <DateTimePicker
                            value={emp.startTime}
                            onChange={(v) => updateEmployee(emp.key, 'startTime', v)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <DateTimePicker
                            value={emp.endTime}
                            onChange={(v) => updateEmployee(emp.key, 'endTime', v)}
                            minDate={emp.startTime ? emp.startTime.split('T')[0] : undefined}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium text-center min-w-[60px]">
                            {dur ? fmtMinutes(dur) : '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={emp.plannedTask}
                            onChange={(e) => updateEmployee(emp.key, 'plannedTask', e.target.value)}
                            placeholder="e.g. Fix Bug #123"
                            maxLength={150}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeEmployee(emp.key)}
                            disabled={employees.length === 1}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={employees.length === 1 ? 'At least one row is required' : 'Remove row'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addEmployee}
              className="mt-4 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Employee
            </button>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/ot-management')}
            disabled={submitting}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Submit Plan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateOtPlanPage;
