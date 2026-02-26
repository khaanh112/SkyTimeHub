import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { leaveRequestService, approverService } from '../services';
import { UserMultiSelect } from '../components';
import { useAuth } from '../context';
import { toast } from 'react-toastify';
import {
  Calendar,
  AlertCircle,
  ChevronDown,
  Info,
  Upload,
  X,
  Plus,
  AlertTriangle,
} from 'lucide-react';

// ── Time slots for compensatory working plan (30-min increments, full 24h) ──
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
})();

const formatCompDuration = (startDate, startTime, endDate, endTime) => {
  if (!startDate || !startTime || !endDate || !endTime) return '';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const s = new Date(startDate);
  s.setHours(sh, sm, 0, 0);
  const e = new Date(endDate);
  e.setHours(eh, em, 0, 0);
  const totalMinutes = Math.round((e - s) / (1000 * 60));
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}m`;
};

// ── Custom Dropdown Component ──────────────────────────────────────────
const CustomDropdown = ({ value, options, onChange, placeholder = 'Select...', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        setTooltip(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                opt.value === value ? 'bg-blue-50' : ''
              }`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
                setTooltip(null);
              }}
            >
              <span className={`text-sm ${opt.value === value ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {opt.label}
              </span>
              {opt.description && (
                <div className="relative">
                  <Info
                    className="w-4 h-4 text-blue-400 hover:text-blue-600 cursor-help"
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setTooltip(opt.value);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                  {tooltip === opt.value && (
                    <div className="absolute right-0 bottom-full mb-2 w-52 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-60">
                      {opt.description}
                      <div className="absolute top-full right-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Limit Exceeded Dialog ──────────────────────────────────────────────
const LimitExceededDialog = ({ warnings, items, durationDays, onCancel, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-2xl mx-4 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <h3 className="text-lg font-bold text-amber-900">Balance Warning</h3>
        </div>
        <div className="space-y-3 mb-6">
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-800">{w}</p>
          ))}
        </div>
        {items && items.length > 0 && (
          <div className="space-y-2 mb-6 p-4 bg-white/60 rounded-lg">
            <p className="text-sm font-semibold text-amber-900">Breakdown ({durationDays} days total):</p>
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-amber-700">{item.note || `Type #${item.leaveTypeId}`}</span>
                <span className="text-amber-900 font-semibold">{item.amountDays} days</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors font-medium bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page Component ────────────────────────────────────────────────
const CreateLeaveRequestPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [approver, setApprover] = useState(null);
  const [loadingApprover, setLoadingApprover] = useState(true);
  const [showLimitExceeded, setShowLimitExceeded] = useState(false);
  const [limitInfo, setLimitInfo] = useState({ warnings: [], items: [], durationDays: 0 });

  // Dynamic leave types fetched from API
  const [leaveCategories, setLeaveCategories] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const [formData, setFormData] = useState({
    leaveCategory: '',   // category code (e.g. 'ANNUAL')
    leaveTypeId: null,    // actual leave_type.id sent to backend
    startDate: '',
    startSession: 'AM', // AM = 8:30, PM = 13:00
    endDate: '',
    endSession: 'PM',   // AM = 12:00, PM = 17:30
    reason: '',
    workSolution: '',
    ccUserIds: [],
    // Compensatory-specific
    compensationMethod: 'fund', // 'fund' | 'working_plan'
    compensatoryPlans: [{ startDate: '', startTime: '08:30', endDate: '', endTime: '17:30' }],
    // Social Benefits-specific
    attachments: [],
  });

  useEffect(() => {
    fetchApprover();
    fetchLeaveTypes();
  }, []);

  // When category changes, auto-select leaveTypeId
  useEffect(() => {
    const cat = leaveCategories.find((c) => c.code === formData.leaveCategory);
    if (!cat) {
      setFormData((prev) => ({ ...prev, leaveTypeId: null }));
      return;
    }
    // If category has exactly 1 type, auto-select it
    if (cat.leaveTypes.length === 1) {
      setFormData((prev) => ({ ...prev, leaveTypeId: cat.leaveTypes[0].id }));
    } else {
      // Reset — user must pick a sub-type
      setFormData((prev) => ({ ...prev, leaveTypeId: null }));
    }
  }, [formData.leaveCategory, leaveCategories]);

  // Auto-suggest end date for POLICY / SOCIAL leave types
  useEffect(() => {
    if (!formData.leaveTypeId || !formData.startDate) return;
    const cat = leaveCategories.find((c) => c.code === formData.leaveCategory);
    if (!cat || (cat.code !== 'POLICY' && cat.code !== 'SOCIAL')) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await leaveRequestService.suggestEndDate(
          formData.leaveTypeId,
          formData.startDate,
          formData.startSession,
        );
        const data = res.data || res;
        if (!cancelled && data?.suggestedEndDate) {
          setFormData((prev) => ({
            ...prev,
            endDate: data.suggestedEndDate,
            endSession: data.suggestedEndSession || 'PM',
          }));
        }
      } catch {
        // Suggestion failed — user can still input manually
      }
    })();
    return () => { cancelled = true; };
  }, [formData.leaveTypeId, formData.startDate, formData.startSession]);

  const fetchLeaveTypes = async () => {
    try {
      setLoadingTypes(true);
      const res = await leaveRequestService.getLeaveTypes();
      const types = res.data || res || [];
      setLeaveCategories(types);
      // Default to first category
      if (types.length > 0) {
        setFormData((prev) => ({ ...prev, leaveCategory: types[0].code }));
      }
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast.error('Failed to load leave types');
    } finally {
      setLoadingTypes(false);
    }
  };

  const fetchApprover = async () => {
    if (!user?.id) {
      setLoadingApprover(false);
      return;
    }
    try {
      setLoadingApprover(true);
      const approvers = await approverService.getApproversForUser(user.id);
      if (approvers && approvers.length > 0) {
        setApprover(approvers[0]);
      } else {
        try {
          const requests = await leaveRequestService.getMyLeaveRequests();
          const requestsData = requests.data || requests;
          if (requestsData?.length > 0 && requestsData[0].approver) {
            setApprover(requestsData[0].approver);
          }
        } catch {
          /* no fallback */
        }
      }
    } catch (error) {
      console.error('Error fetching approver:', error);
      toast.warning('Could not load your approver. Please contact HR.');
    } finally {
      setLoadingApprover(false);
    }
  };

  // Calculate duration in half-day slots (matching backend AM/PM session logic).
  // All leave types skip weekends (Sat/Sun). Holidays are only handled server-side.
  const calculateDuration = (startDate, startSession, endDate, endSession) => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    if (e < s) return null;
    if (s.getTime() === e.getTime() && startSession === 'PM' && endSession === 'AM') return null;

    const fmtLocal = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    let totalSlots = 0;
    const current = new Date(s);
    while (current <= e) {
      const day = current.getDay();
      const isWeekend = day === 0 || day === 6;

      if (!isWeekend) {
        const key = fmtLocal(current);
        let amCounts = true;
        let pmCounts = true;
        if (key === startDate && startSession === 'PM') amCounts = false;
        if (key === endDate && endSession === 'AM') pmCounts = false;
        if (amCounts) totalSlots++;
        if (pmCounts) totalSlots++;
      }
      current.setDate(current.getDate() + 1);
    }

    if (totalSlots <= 0) return null;
    return totalSlots * 0.5;
  };

  const formatDuration = (days) => {
    if (days === null || days === undefined) return '';
    if (days === 0.5) return '0.5 Day';
    if (Number.isInteger(days)) return `${days} Days`;
    return `${days} Days`;
  };

  const formatDateTime = (date, session, type) => {
    if (!date) return '';
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    if (type === 'start') {
      return `${dd}/${mm}/${yyyy} ${session === 'AM' ? '8:30' : '13:00'}`;
    }
    return `${dd}/${mm}/${yyyy} ${session === 'AM' ? '12:00' : '17:30'}`;
  };

  const totalDuration = calculateDuration(formData.startDate, formData.startSession, formData.endDate, formData.endSession);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.leaveTypeId) {
      toast.error('Please select a leave type');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be after start date');
      return;
    }
    if (!formData.reason || formData.reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }
    if (formData.reason.trim().length > 500) {
      toast.error('Reason must not exceed 500 characters');
      return;
    }
    if (formData.workSolution && formData.workSolution.length > 1000) {
      toast.error('Work solution must not exceed 1000 characters');
      return;
    }
    if (!approver && !loadingApprover) {
      toast.error('You must have an approver assigned. Please contact HR.');
      return;
    }

    await doSubmit(false);
  };

  const doSubmit = async (confirmDespiteWarning = false) => {
    try {
      setSubmitting(true);
      const payload = {
        leaveTypeId: formData.leaveTypeId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startSession: formData.startSession,
        endSession: formData.endSession,
        reason: formData.reason,
        workSolution: formData.workSolution || undefined,
        ccUserIds: formData.ccUserIds,
        confirmDespiteWarning,
      };
      await leaveRequestService.createLeaveRequest(payload);
      toast.success('Leave request submitted successfully!');
      navigate('/leave-requests');
    } catch (error) {
      console.error('Error creating leave request:', error);
      const data = error.response?.data;

      // Handle requiresConfirmation response (balance warning)
      let parsed = null;
      try { parsed = typeof data?.message === 'string' ? JSON.parse(data.message) : null; } catch { /* not JSON */ }

      if (parsed?.requiresConfirmation) {
        setLimitInfo({
          warnings: parsed.warnings || [],
          items: parsed.items || [],
          durationDays: parsed.durationDays || 0,
        });
        setShowLimitExceeded(true);
        return;
      }

      if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
        data.details.forEach((msg) => toast.error(msg));
      } else {
        toast.error(data?.message || 'Failed to create leave request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Compensatory Plan helpers ──
  const addCompensatoryPlan = () => {
    setFormData((prev) => ({
      ...prev,
      compensatoryPlans: [...prev.compensatoryPlans, { startDate: '', startTime: '08:30', endDate: '', endTime: '17:30' }],
    }));
  };

  const updateCompensatoryPlan = (index, field, value) => {
    setFormData((prev) => {
      const plans = [...prev.compensatoryPlans];
      plans[index] = { ...plans[index], [field]: value };
      return { ...prev, compensatoryPlans: plans };
    });
  };

  const removeCompensatoryPlan = (index) => {
    setFormData((prev) => ({
      ...prev,
      compensatoryPlans: prev.compensatoryPlans.filter((_, i) => i !== index),
    }));
  };

  // ── Attachment helpers ──
  const handleFileDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []);
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024); // 10MB limit
    if (valid.length < files.length) {
      toast.warning('Some files exceed the 10MB size limit and were not added.');
    }
    setFormData((prev) => ({ ...prev, attachments: [...prev.attachments, ...valid] }));
  };

  const removeAttachment = (index) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  // ── Derived state ──
  const selectedCategory = leaveCategories.find((c) => c.code === formData.leaveCategory);
  const hasSubTypes = selectedCategory && !selectedCategory.autoConvert && selectedCategory.leaveTypes.length > 1;
  const isCompensatory = formData.leaveCategory === 'COMPENSATORY';
  const isSocialBenefits = formData.leaveCategory === 'SOCIAL';

  const requestHours = totalDuration ? totalDuration * 8 : 0;

  // Section numbering
  let sectionIndex = 0;
  const nextSection = () => ++sectionIndex;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-1">
        <nav className="text-sm text-gray-500">
          <Link to="/leave-requests" className="hover:text-blue-600 transition-colors">
            Leave Management
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-700">New Request</span>
        </nav>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Leave Request</h1>

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">

          {/* ──────── Section: Basic Info ──────── */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold">
                {nextSection()}
              </div>
              <h3 className="text-base font-bold text-gray-900">Basic Info</h3>
            </div>

            <div className={`grid gap-4 ${hasSubTypes ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
              {/* Leave Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                {loadingTypes ? (
                  <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400">Loading...</div>
                ) : (
                  <CustomDropdown
                    value={formData.leaveCategory}
                    options={leaveCategories.map((c) => ({ value: c.code, label: c.name }))}
                    onChange={(val) => setFormData({ ...formData, leaveCategory: val, leaveTypeId: null })}
                    placeholder="Select leave type"
                  />
                )}
              </div>

              {/* Sub-type (conditional — when category has multiple user-selectable leave types) */}
              {hasSubTypes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">&nbsp;</label>
                  <CustomDropdown
                    value={formData.leaveTypeId ? String(formData.leaveTypeId) : ''}
                    options={selectedCategory.leaveTypes.map((lt) => ({ value: String(lt.id), label: lt.name }))}
                    onChange={(val) => setFormData({ ...formData, leaveTypeId: Number(val) })}
                    placeholder="Select sub-type"
                  />
                </div>
              )}

              {/* Approver */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Approver</label>
                <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 min-h-10.5 flex items-center">
                  {loadingApprover ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : approver ? (
                    <span className="font-medium text-gray-800">{approver.username}</span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      No approver assigned
                    </span>
                  )}
                </div>
              </div>
            </div>
            {selectedCategory?.autoConvert && (
              <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">Paid leave will be used first. If your paid balance is exhausted, the remaining days will automatically convert to unpaid leave.</p>
              </div>
            )}
          </div>

          {/* ──────── Section: Time Selection ──────── */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold">
                {nextSection()}
              </div>
              <h3 className="text-base font-bold text-gray-900">Time Selection</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Start */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Start <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <select
                    value={formData.startSession}
                    onChange={(e) => setFormData({ ...formData, startSession: e.target.value })}
                    className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="AM">8:30</option>
                    <option value="PM">13:00</option>
                  </select>
                </div>
              </div>
              {/* End */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  End <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    min={formData.startDate || undefined}
                  />
                  <select
                    value={formData.endSession}
                    onChange={(e) => setFormData({ ...formData, endSession: e.target.value })}
                    className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="AM">12:00</option>
                    <option value="PM">17:30</option>
                  </select>
                </div>
              </div>
              {/* Total Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Duration</label>
                <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-medium min-h-10.5 flex items-center">
                  {formatDuration(totalDuration)}
                </div>
              </div>
            </div>
          </div>

          {/* ──────── Section: Justification ──────── */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold">
                {nextSection()}
              </div>
              <h3 className="text-base font-bold text-gray-900">Justification</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows="3"
                  maxLength={500}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Please provide the reason for your leave request..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Work Solution / Handover
                </label>
                <textarea
                  value={formData.workSolution}
                  onChange={(e) => setFormData({ ...formData, workSolution: e.target.value })}
                  rows="3"
                  maxLength={1000}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder={
                    isCompensatory
                      ? 'Please describe how your work will be handled during your absence...'
                      : 'Describe how your work will be handled during your absence...'
                  }
                />
              </div>
            </div>
          </div>

          {/* ──────── Section: Additional ──────── */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold">
                {nextSection()}
              </div>
              <h3 className="text-base font-bold text-gray-900">Additional</h3>
            </div>

            <div className="space-y-5">
              {/* Attachments — only for Social Benefits Leave */}
              {isSocialBenefits && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Attachments</label>
                  <div
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('file-upload').click()}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileDrop}
                    />
                    <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Drag and drop files here or{' '}
                      <span className="text-blue-600 font-medium hover:underline">browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Maximum file size 10MB</p>
                  </div>
                  {formData.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formData.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                          <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CC Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CC</label>
                <UserMultiSelect
                  selectedUserIds={formData.ccUserIds}
                  onChange={(userIds) => setFormData({ ...formData, ccUserIds: userIds })}
                  excludeCurrentUser={true}
                />
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Your approver and all HR users will automatically receive email notifications
                </p>
              </div>
            </div>
          </div>

          {/* ──────── Section: Compensation Method (Compensatory only) ──────── */}
          {isCompensatory && (
            <div>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold">
                  {nextSection()}
                </div>
                <h3 className="text-base font-bold text-gray-900">Compensation Method</h3>
              </div>

              <div className="space-y-5">
                {/* Option 1: Use Compensatory Fund */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="compensationMethod"
                    value="fund"
                    checked={formData.compensationMethod === 'fund'}
                    onChange={() => setFormData({ ...formData, compensationMethod: 'fund' })}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">Use Compensatory Fund</span>
                    <div className="mt-1.5 text-sm text-gray-600 space-y-0.5">
                      <p>This request: {requestHours} hours</p>
                    </div>
                  </div>
                </label>

                {/* Option 2: Register Compensatory Working Plan */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="compensationMethod"
                    value="working_plan"
                    checked={formData.compensationMethod === 'working_plan'}
                    onChange={() => setFormData({ ...formData, compensationMethod: 'working_plan' })}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">Register Compensatory Working Plan</span>
                </label>

                {formData.compensationMethod === 'working_plan' && (
                  <div className="ml-7 space-y-4">
                    {formData.compensatoryPlans.map((plan, idx) => (
                      <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_auto_auto] gap-3 items-end">
                          {/* Start Date */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              Start <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={plan.startDate}
                              onChange={(e) => updateCompensatoryPlan(idx, 'startDate', e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            />
                          </div>
                          {/* Start Time */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">&nbsp;</label>
                            <select
                              value={plan.startTime}
                              onChange={(e) => updateCompensatoryPlan(idx, 'startTime', e.target.value)}
                              className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              {TIME_SLOTS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          {/* End Date */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              End <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={plan.endDate}
                              onChange={(e) => updateCompensatoryPlan(idx, 'endDate', e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              min={plan.startDate || undefined}
                            />
                          </div>
                          {/* End Time */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">&nbsp;</label>
                            <select
                              value={plan.endTime}
                              onChange={(e) => updateCompensatoryPlan(idx, 'endTime', e.target.value)}
                              className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              {TIME_SLOTS.map((t) => {
                                // If same day, only show times after start time
                                if (plan.startDate && plan.endDate && plan.startDate === plan.endDate) {
                                  return t > plan.startTime ? <option key={t} value={t}>{t}</option> : null;
                                }
                                return <option key={t} value={t}>{t}</option>;
                              })}
                            </select>
                          </div>
                          {/* Total Duration */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
                            <div className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 font-medium min-h-10.5 flex items-center min-w-20 whitespace-nowrap">
                              {formatCompDuration(plan.startDate, plan.startTime, plan.endDate, plan.endTime)}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {formData.compensatoryPlans.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCompensatoryPlan(idx)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            )}
                            {idx === formData.compensatoryPlans.length - 1 && (
                              <button
                                type="button"
                                onClick={addCompensatoryPlan}
                                className="p-2 text-blue-600 hover:bg-blue-50 border border-blue-300 rounded-lg transition-colors"
                                title="Add another plan"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────── Actions ──────── */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/leave-requests')}
              disabled={submitting}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingApprover || !approver}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              title={!approver && !loadingApprover ? 'You need an approver assigned before submitting' : ''}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ──────── Limit Exceeded Dialog ──────── */}
      {showLimitExceeded && (
        <LimitExceededDialog
          warnings={limitInfo.warnings}
          items={limitInfo.items}
          durationDays={limitInfo.durationDays}
          onCancel={() => setShowLimitExceeded(false)}
          onConfirm={() => {
            setShowLimitExceeded(false);
            doSubmit(true);
          }}
        />
      )}
    </div>
  );
};

export default CreateLeaveRequestPage;
