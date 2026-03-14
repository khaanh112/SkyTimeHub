import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { otService } from '../services';
import { LoadingSpinner } from '../components';
import { toast } from 'react-toastify';
import { ArrowLeft } from 'lucide-react';
import { fmtDate, toInputTime as fmtTime } from '../utils/date';

// ── Helpers ─────────────────────────────────────────────────────────────

const fmtDuration = (minutes) => {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Minute${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${h} Hour${h !== 1 ? 's' : ''}`;
  return `${h} Hour${h !== 1 ? 's' : ''} ${m} Minute${m !== 1 ? 's' : ''}`;
};

// ── Status Badge ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = {
    approved:    { dot: 'bg-blue-500',   text: 'text-blue-700',   label: 'Approved' },
    checked_in:  { dot: 'bg-green-500',  text: 'text-green-700',  label: 'Checked In' },
    checked_out: { dot: 'bg-indigo-500', text: 'text-indigo-700', label: 'Checked Out' },
    confirmed:   { dot: 'bg-teal-500',   text: 'text-teal-700',   label: 'Confirmed' },
    rejected:    { dot: 'bg-red-500',    text: 'text-red-700',    label: 'Rejected' },
    missed:      { dot: 'bg-red-400',    text: 'text-red-700',    label: 'Missed' },
    cancelled:   { dot: 'bg-gray-400',   text: 'text-gray-600',   label: 'Cancelled' },
  };
  const c = cfg[status?.toLowerCase()] || { dot: 'bg-gray-400', text: 'text-gray-600', label: status };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      <span className={`text-sm font-medium ${c.text}`}>{c.label}</span>
    </div>
  );
};

// ── Detail Row ────────────────────────────────────────────────────────────

const DetailRow = ({ label, value, valueClass = 'text-gray-900' }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className={`text-sm font-semibold ${valueClass}`}>{value ?? '—'}</p>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────

const AssignedOtDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Checkout form state
  const [workOutput, setWorkOutput] = useState('');
  const [compensatoryMethod, setCompensatoryMethod] = useState('');

  const fetchAssignment = async () => {
    try {
      setLoading(true);
      const data = await otService.getMyAssignment(id);
      setAssignment(data);
      // Pre-fill work output and OT benefits if already checked in
      if (data.checkin?.workOutput) setWorkOutput(data.checkin.workOutput);
      if (data.checkin?.compensatoryMethod) setCompensatoryMethod(data.checkin.compensatoryMethod);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load assignment details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssignment(); }, [id]);

  const handleCheckin = async () => {
    try {
      setSubmitting(true);
      console.log('[handleCheckin] assignment.id=', assignment.id, 'type=', typeof assignment.id);
      await otService.checkin(assignment.id);
      toast.success('Checked in successfully');
      fetchAssignment();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to check in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (!workOutput.trim()) {
      toast.error('Work output is required');
      return;
    }
    if (!compensatoryMethod) {
      toast.error('Please select OT benefits');
      return;
    }
    try {
      setSubmitting(true);
      await otService.checkout(
        assignment.checkin.id,
        workOutput,
        compensatoryMethod,
        assignment.checkin.version,
      );
      toast.success('Checked out successfully');
      fetchAssignment();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Record has been modified. Refreshing...');
        fetchAssignment();
      } else {
        toast.error(error.response?.data?.message || 'Failed to check out');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-500">Loading assignment details...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Assignment not found</h3>
        <button
          onClick={() => navigate('/ot-management')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm mt-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to OT Management
        </button>
      </div>
    );
  }

  const { checkin, status } = assignment;
  const showCheckin = ['checked_in', 'checked_out', 'confirmed', 'rejected'].includes(status);
  const showCheckout = ['checked_out', 'confirmed', 'rejected'].includes(status);
  const showActualDuration = ['checked_out', 'confirmed'].includes(status);
  const showOutcome = ['checked_in', 'checked_out', 'confirmed', 'rejected'].includes(status);
  const isEditableOutcome = status === 'checked_in';

  // Time fields derived from startTime/endTime
  const plannedDate = fmtDate(assignment.startTime);
  const startTimeStr = fmtTime(assignment.startTime);
  const endTimeStr = fmtTime(assignment.endTime);
  const plannedTimeRange = startTimeStr && endTimeStr ? `${startTimeStr} - ${endTimeStr}` : '—';

  const checkinTime = showCheckin ? fmtTime(checkin?.checkInAt) : null;
  const checkoutTime = showCheckout ? fmtTime(checkin?.checkOutAt) : null;

  const benefitLabel =
    checkin?.compensatoryMethod === 'paid'
      ? 'Paid Overtime'
      : checkin?.compensatoryMethod === 'comp_leave'
      ? 'Compensatory Leave'
      : '—';

  const showActionBtn = ['approved', 'checked_in'].includes(status);

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header / Breadcrumb ──────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <nav className="flex items-center gap-1 text-sm text-gray-500 mb-1">
            <Link
              to="/ot-management"
              className="hover:text-blue-600 transition-colors"
            >
              OT Management
            </Link>
            <span className="mx-1">›</span>
            <span className="text-gray-900 font-medium">Assigned OT Details</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">Assigned OT Details</h1>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* ── Time & Attendance Log ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Time & Attendance Log</h2>
        <div className="grid grid-cols-2 gap-8">
          {/* Left: Scheduled Time */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Scheduled Time
            </p>
            <div className="space-y-4">
              <DetailRow label="Date" value={plannedDate} />
              <DetailRow label="Time" value={plannedTimeRange} />
              <DetailRow label="Duration" value={fmtDuration(assignment.durationMinutes)} />
            </div>
          </div>

          {/* Right: Actual Check-in/Out */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Actual Check-in/Out
            </p>
            <div className="space-y-4">
              {showCheckin ? (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Check-in</p>
                  <p className="text-sm font-semibold text-green-600">{checkinTime ?? '—'}</p>
                </div>
              ) : null}
              {showCheckout && (
                <DetailRow label="Check-out" value={checkoutTime ?? '—'} />
              )}
              {showActualDuration && (
                <DetailRow
                  label="Actual Duration"
                  value={fmtDuration(checkin?.actualDurationMinutes)}
                />
              )}
              {!showCheckin && (
                <p className="text-xs text-gray-400 italic">No check-in recorded yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Outcome & OT Benefits ────────────────────────────── */}
      {showOutcome && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Outcome & OT Benefits</h2>

          {/* Work Output */}
          <div className="mb-5">
            <label className="block text-sm text-gray-600 mb-1.5">
              Work Output {isEditableOutcome && <span className="text-red-500">*</span>}
            </label>
            {isEditableOutcome ? (
              <textarea
                value={workOutput}
                onChange={(e) => setWorkOutput(e.target.value)}
                placeholder="Describe the work you completed..."
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm text-gray-900"
              />
            ) : (
              <p className="text-sm text-gray-900">{checkin?.workOutput || '—'}</p>
            )}
          </div>

          {/* OT Benefits */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              OT Benefits {isEditableOutcome && <span className="text-red-500">*</span>}
            </label>
            {isEditableOutcome ? (
              <div className="flex gap-8">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="compensatoryMethod"
                    value="paid"
                    checked={compensatoryMethod === 'paid'}
                    onChange={(e) => setCompensatoryMethod(e.target.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">Paid Overtime</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="compensatoryMethod"
                    value="comp_leave"
                    checked={compensatoryMethod === 'comp_leave'}
                    onChange={(e) => setCompensatoryMethod(e.target.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">Compensatory Leave</span>
                </label>
              </div>
            ) : (
              <p className="text-sm text-gray-900">{benefitLabel}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Context & Source ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Context & Source</h2>
        <div className="space-y-4">
          <DetailRow label="OT Plan Title" value={assignment.planTitle} />
          <DetailRow label="Planned task" value={assignment.plannedTask} />
        </div>
      </div>

      {/* ── Footer Buttons ───────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate('/ot-management')}
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        {showActionBtn && (
          status === 'approved' ? (
            <button
              onClick={handleCheckin}
              disabled={submitting}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <LoadingSpinner size="sm" />}
              Check in
            </button>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={submitting || !workOutput.trim() || !compensatoryMethod}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <LoadingSpinner size="sm" />}
              Check out
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default AssignedOtDetailPage;
