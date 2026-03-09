import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { otService, userService } from '../services';
import { LoadingSpinner } from '../components';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  ChevronDown,
  Clock,
  Info,
  AlertCircle,
} from 'lucide-react';

// ── Employee Dropdown with OT summary tooltip ────────────────────────

const EmployeeSelector = ({ value, users, onChange, excludeIds }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tooltip, setTooltip] = useState(null);
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

  const handleHover = async (userId) => {
    try {
      const summary = await otService.getEmployeeOtSummary(userId);
      setTooltip({ userId, ...summary });
    } catch {
      setTooltip(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.username : 'Select employee...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
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
                className="relative px-3 py-2.5 cursor-pointer hover:bg-gray-50 text-sm text-gray-700 flex items-center justify-between"
                onClick={() => { onChange(u.id); setIsOpen(false); setSearch(''); }}
                onMouseEnter={() => handleHover(u.id)}
                onMouseLeave={() => setTooltip(null)}
              >
                <span>{u.username} <span className="text-gray-400 text-xs">({u.email})</span></span>
                {tooltip && tooltip.userId === u.id && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg w-56">
                    <div className="font-semibold mb-1.5 flex items-center gap-1.5"><Clock className="w-3 h-3" /> OT Summary</div>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Today:</span><span>{tooltip.todayHours ?? 0}h</span></div>
                      <div className="flex justify-between"><span>This Month:</span><span>{tooltip.monthHours ?? 0}h</span></div>
                      <div className="flex justify-between"><span>This Year:</span><span>{tooltip.yearHours ?? 0}h</span></div>
                    </div>
                  </div>
                )}
              </div>
            ))
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

// Convert ISO string to datetime-local value
const toLocalDatetime = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ── Main Page ─────────────────────────────────────────────────────────

const EditOtPlanPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [plan, setPlan] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const [employees, setEmployees] = useState([]);
  const nextKey = useRef(1);

  // Load users and plan data
  useEffect(() => {
    (async () => {
      try {
        setLoadingUsers(true);
        const res = await userService.getAll();
        setUsers(Array.isArray(res) ? res : res.data || []);
      } catch {
        toast.error('Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    })();

    (async () => {
      try {
        setLoading(true);
        const data = await otService.getOtPlan(id);
        setPlan(data);
        setFormData({
          title: data.title || '',
          description: data.description || '',
        });
        const emps = (data.employees || []).map((e) => ({
          key: nextKey.current++,
          employeeId: e.employeeId || e.employee?.id,
          startTime: toLocalDatetime(e.startTime),
          endTime: toLocalDatetime(e.endTime),
          plannedTask: e.plannedTask || '',
        }));
        setEmployees(emps.length > 0 ? emps : [{ key: nextKey.current++, employeeId: null, startTime: '', endTime: '', plannedTask: '' }]);
      } catch (error) {
        console.error('Error fetching OT plan:', error);
        toast.error('Failed to load OT plan');
        navigate('/ot-management');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Compute total duration
  const totalMinutes = employees.reduce((sum, emp) => {
    const d = calcDurationMinutes(emp.startTime, emp.endTime);
    return sum + (d || 0);
  }, 0);

  const addEmployee = () => {
    setEmployees((prev) => [
      ...prev,
      { key: nextKey.current++, employeeId: null, startTime: '', endTime: '', plannedTask: '' },
    ]);
  };

  const removeEmployee = (key) => {
    if (employees.length === 1) {
      toast.error('At least one employee is required');
      return;
    }
    setEmployees((prev) => prev.filter((e) => e.key !== key));
  };

  const updateEmployee = (key, field, value) => {
    setEmployees((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || formData.title.trim().length < 1) {
      toast.error('Title is required');
      return;
    }

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      if (!emp.employeeId) {
        toast.error(`Employee ${i + 1}: Please select an employee`);
        return;
      }
      if (!emp.startTime || !emp.endTime) {
        toast.error(`Employee ${i + 1}: Start and end times are required`);
        return;
      }
      if (new Date(emp.endTime) <= new Date(emp.startTime)) {
        toast.error(`Employee ${i + 1}: End time must be after start time`);
        return;
      }
      if (!emp.plannedTask || emp.plannedTask.trim().length < 1) {
        toast.error(`Employee ${i + 1}: Planned task is required`);
        return;
      }
    }

    const ids = employees.map((e) => e.employeeId);
    if (new Set(ids).size !== ids.length) {
      toast.error('Duplicate employees are not allowed');
      return;
    }

    try {
      setSubmitting(true);
      await otService.updateOtPlan(id, {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        employees: employees.map((emp) => ({
          employeeId: emp.employeeId,
          startTime: new Date(emp.startTime).toISOString(),
          endTime: new Date(emp.endTime).toISOString(),
          plannedTask: emp.plannedTask.trim(),
        })),
        version: plan.version,
      });
      toast.success('OT plan updated successfully!');
      navigate('/ot-management');
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('This plan has been modified by another user. Refreshing...');
        const data = await otService.getOtPlan(id);
        setPlan(data);
        return;
      }
      const data = error.response?.data;
      if (data?.details?.length) {
        data.details.forEach((m) => toast.error(m));
      } else {
        toast.error(data?.message || 'Failed to update OT plan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!plan) return null;

  if (plan.status !== 'pending') {
    return (
      <div className="w-full">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Cannot Edit Plan</h3>
              <p className="text-sm text-yellow-800 mb-4">
                Only pending OT plans can be edited. Current status: <strong>{plan.status}</strong>
              </p>
              <button
                onClick={() => navigate('/ot-management')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back to OT Management
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedEmployeeIds = employees.map((e) => e.employeeId).filter(Boolean);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/ot-management')}
          className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to OT Management</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit OT Plan</h1>
        <p className="text-sm text-gray-600 mt-1">Update the details for your OT plan</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800"><strong>Note:</strong> Changes will notify the approver for review.</div>
        </div>
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
                  maxLength={500}
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
              <span className="text-xs text-gray-500">({employees.length} employee{employees.length > 1 ? 's' : ''})</span>
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
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[22%]">Employee <span className="text-red-500">*</span></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%]">Start Time <span className="text-red-500">*</span></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%]">End Time <span className="text-red-500">*</span></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[10%]">Duration</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[22%]">Planned Task <span className="text-red-500">*</span></th>
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
                          {loadingUsers ? (
                            <div className="text-sm text-gray-400">Loading...</div>
                          ) : (
                            <EmployeeSelector
                              value={emp.employeeId}
                              users={users}
                              onChange={(id) => updateEmployee(emp.key, 'employeeId', id)}
                              excludeIds={selectedEmployeeIds.filter((id) => id !== emp.employeeId)}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="datetime-local"
                            value={emp.startTime}
                            onChange={(e) => updateEmployee(emp.key, 'startTime', e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="datetime-local"
                            value={emp.endTime}
                            onChange={(e) => updateEmployee(emp.key, 'endTime', e.target.value)}
                            min={emp.startTime || undefined}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium text-center">
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
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove employee"
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
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Update Plan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditOtPlanPage;
