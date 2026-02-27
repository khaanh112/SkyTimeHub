import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { UserMultiSelect, LoadingSpinner } from '../components';
import { toast } from 'react-toastify';
import { ArrowLeft, AlertCircle, CheckCircle, User, ChevronDown, Info, AlertTriangle } from 'lucide-react';

// ── Custom Dropdown ────────────────────────────────────────────────────
const CustomDropdown = ({ value, options, onChange, placeholder = 'Select...', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.map((opt) => (
            <div key={opt.value} className={`px-3 py-2.5 cursor-pointer hover:bg-gray-50 text-sm ${opt.value === value ? 'bg-blue-50 font-semibold text-gray-900' : 'text-gray-700'}`} onClick={() => { onChange(opt.value); setIsOpen(false); }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Balance Warning Dialog ─────────────────────────────────────────────
const BalanceWarningDialog = ({ warnings, items, durationDays, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
    <div className="relative w-full max-w-2xl mx-4 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-6 h-6 text-amber-600" />
        <h3 className="text-lg font-bold text-amber-900">Balance Warning</h3>
      </div>
      <div className="space-y-3 mb-6">
        {warnings.map((w, i) => (<p key={i} className="text-sm text-amber-800">{w}</p>))}
      </div>
      {items?.length > 0 && (
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
        <button type="button" onClick={onCancel} className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors font-medium bg-white">Cancel</button>
        <button type="button" onClick={onConfirm} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">Confirm</button>
      </div>
    </div>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────
const EditLeaveRequestPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [leaveCategories, setLeaveCategories] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [warningInfo, setWarningInfo] = useState({ warnings: [], items: [], durationDays: 0 });
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const [formData, setFormData] = useState({
    leaveCategory: '',
    leaveTypeId: null,
    startDate: '',
    startSession: 'AM',
    endDate: '',
    endSession: 'PM',
    reason: '',
    workSolution: '',
    ccUserIds: [],
  });

  useEffect(() => { fetchLeaveTypes(); fetchLeaveRequest(); }, [id]);

  const fetchLeaveTypes = async () => {
    try {
      setLoadingTypes(true);
      const res = await leaveRequestService.getLeaveTypes();
      setLeaveCategories(res.data || res || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  const fetchLeaveRequest = async () => {
    try {
      setLoading(true);
      const response = await leaveRequestService.getLeaveRequest(id);
      const data = response.data || response;
      setRequest(data);
      const categoryCode = data.requestedLeaveType?.category?.code || '';
      setFormData({
        leaveCategory: categoryCode,
        leaveTypeId: data.requestedLeaveTypeId || data.requestedLeaveType?.id || null,
        startDate: data.startDate,
        startSession: data.startSession || 'AM',
        endDate: data.endDate,
        endSession: data.endSession || 'PM',
        reason: data.reason || '',
        workSolution: data.workSolution || '',
        ccUserIds: data.ccUserIds || [],
      });
      setInitialLoadDone(true);
    } catch (error) {
      console.error('Error fetching leave request:', error);
      toast.error('Failed to load leave request');
      navigate('/leave-requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (code) => {
    const cat = leaveCategories.find((c) => c.code === code);
    const autoTypeId = cat?.leaveTypes.length === 1 ? cat.leaveTypes[0].id : null;
    setFormData((prev) => ({ ...prev, leaveCategory: code, leaveTypeId: autoTypeId }));
  };

  // Auto-suggest end date for POLICY / SOCIAL leave types (only after user changes, not on initial load)
  const prevSuggestKey = useRef('');
  useEffect(() => {
    if (!initialLoadDone || !formData.leaveTypeId || !formData.startDate) return;
    const cat = leaveCategories.find((c) => c.code === formData.leaveCategory);
    if (!cat || (cat.code !== 'POLICY' && cat.code !== 'SOCIAL')) return;

    // Build a key to detect actual user changes vs initial load
    const suggestKey = `${formData.leaveTypeId}-${formData.startDate}-${formData.startSession}`;
    if (prevSuggestKey.current === '' ) {
      // First run after initial load — skip suggestion (keep server data)
      prevSuggestKey.current = suggestKey;
      return;
    }
    if (prevSuggestKey.current === suggestKey) return;
    prevSuggestKey.current = suggestKey;

    let cancelled = false;
    (async () => {
      try {
        const res = await leaveRequestService.suggestEndDate({
          leaveTypeId: formData.leaveTypeId,
          startDate: formData.startDate,
          startSession: formData.startSession,
        });
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
  }, [initialLoadDone, formData.leaveTypeId, formData.startDate, formData.startSession, leaveCategories]);

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
    return `${days} Days`;
  };

  const totalDuration = calculateDuration(formData.startDate, formData.startSession, formData.endDate, formData.endSession);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leaveTypeId) { toast.error('Please select a leave type'); return; }
    if (!formData.startDate || !formData.endDate) { toast.error('Please select start and end dates'); return; }
    if (new Date(formData.endDate) < new Date(formData.startDate)) { toast.error('End date must be after start date'); return; }
    if (!formData.reason || formData.reason.trim().length < 5) { toast.error('Reason must be at least 5 characters'); return; }
    if (formData.reason.trim().length > 500) { toast.error('Reason must not exceed 500 characters'); return; }
    if (formData.workSolution && formData.workSolution.length > 1000) { toast.error('Work solution must not exceed 1000 characters'); return; }
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
      await leaveRequestService.updateLeaveRequest(id, payload);
      toast.success('Leave request updated successfully!');
      navigate('/leave-requests');
    } catch (error) {
      const data = error.response?.data;
      let parsed = null;
      try { parsed = typeof data?.message === 'string' ? JSON.parse(data.message) : null; } catch { /* */ }
      if (parsed?.requiresConfirmation) {
        setWarningInfo({ warnings: parsed.warnings || [], items: parsed.items || [], durationDays: parsed.durationDays || 0 });
        setShowWarning(true);
        return;
      }
      if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
        data.details.forEach((msg) => toast.error(msg));
      } else {
        toast.error(data?.message || 'Failed to update leave request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = leaveCategories.find((c) => c.code === formData.leaveCategory);
  const hasSubTypes = selectedCategory && !selectedCategory.autoConvert && selectedCategory.leaveTypes.length > 1;

  if (loading) {
    return (<div className="flex items-center justify-center min-h-100"><LoadingSpinner /></div>);
  }

  if (!request) return null;

  if (request.status !== 'pending') {
    return (
      <div className="w-full">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Cannot Edit Request</h3>
              <p className="text-sm text-yellow-800 mb-4">Only pending leave requests can be edited. Status: <strong>{request.status}</strong></p>
              <button onClick={() => navigate('/leave-requests')} className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Back to My Requests
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/leave-requests')} className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to My Requests</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Leave Request</h1>
        <p className="text-sm text-gray-600 mt-1">Update the details for your leave request</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800"><strong>Note:</strong> Changes will notify your approver for review.</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Section 1: Leave Type */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">1</div>
              <h3 className="text-base font-semibold text-gray-900">Leave Type</h3>
            </div>
            <div className={`grid gap-4 ${hasSubTypes ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-1'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                {loadingTypes ? (
                  <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400">Loading...</div>
                ) : (
                  <CustomDropdown value={formData.leaveCategory} options={leaveCategories.map((c) => ({ value: c.code, label: c.name }))} onChange={handleCategoryChange} placeholder="Select category" />
                )}
              </div>
              {hasSubTypes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="text-red-500">*</span></label>
                  <CustomDropdown value={formData.leaveTypeId ? String(formData.leaveTypeId) : ''} options={selectedCategory.leaveTypes.map((lt) => ({ value: String(lt.id), label: lt.name }))} onChange={(val) => setFormData({ ...formData, leaveTypeId: Number(val) })} placeholder="Select type" />
                </div>
              )}
            </div>
            {selectedCategory?.autoConvert && (
              <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">Paid leave will be used first. If your paid balance is exhausted, the remaining days will automatically convert to unpaid leave.</p>
              </div>
            )}
          </div>

          {/* Section 2: Time Selection */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">2</div>
              <h3 className="text-base font-semibold text-gray-900">Time Selection</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Start <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
                  <select value={formData.startSession} onChange={(e) => setFormData({ ...formData, startSession: e.target.value })} className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="AM">8:30</option>
                    <option value="PM">13:00</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">End <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" required min={formData.startDate || undefined} />
                  <select value={formData.endSession} onChange={(e) => setFormData({ ...formData, endSession: e.target.value })} className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="AM">12:00</option>
                    <option value="PM">17:30</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Duration</label>
                <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-medium min-h-10.5 flex items-center">{formatDuration(totalDuration)}</div>
              </div>
            </div>
          </div>

          {/* Section 3: Justification */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">3</div>
              <h3 className="text-base font-semibold text-gray-900">Justification</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
                <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows="6" maxLength={500} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Please provide the reason..." required />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">Minimum 5 characters</p>
                  <p className={`text-xs ${formData.reason.length > 450 ? 'text-amber-500' : 'text-gray-400'}`}>{formData.reason.length}/500</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work Solution / Handover</label>
                <textarea value={formData.workSolution} onChange={(e) => setFormData({ ...formData, workSolution: e.target.value })} rows="6" maxLength={1000} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Describe how your work will be handled..." />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">Optional</p>
                  <p className={`text-xs ${formData.workSolution.length > 900 ? 'text-amber-500' : 'text-gray-400'}`}>{formData.workSolution.length}/1000</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Approver & CC */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">4</div>
              <h3 className="text-base font-semibold text-gray-900">Approver & CC</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Approver</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {request?.approver ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">{request.approver.username?.charAt(0).toUpperCase() || 'A'}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{request.approver.username}</p>
                        <p className="text-xs text-gray-600 truncate">{request.approver.email}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400"><User className="w-5 h-5" /><p className="text-sm italic">No approver assigned</p></div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CC Users</label>
                <UserMultiSelect selectedUserIds={formData.ccUserIds} onChange={(ids) => setFormData({ ...formData, ccUserIds: ids })} excludeCurrentUser={true} />
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Approver & HR are notified automatically</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => navigate('/leave-requests')} disabled={submitting} className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {submitting ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating...</>) : (<><CheckCircle className="w-5 h-5" /> Update Request</>)}
            </button>
          </div>
        </form>
      </div>

      {showWarning && (
        <BalanceWarningDialog warnings={warningInfo.warnings} items={warningInfo.items} durationDays={warningInfo.durationDays} onCancel={() => setShowWarning(false)} onConfirm={() => { setShowWarning(false); doSubmit(true); }} />
      )}
    </div>
  );
};

export default EditLeaveRequestPage;
