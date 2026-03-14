import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { otService } from '../services';
import { LoadingSpinner, Modal } from '../components';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle } from 'lucide-react';
import { fmtDate, toInputTime as fmtTime, toInputDateTime } from '../utils/date';

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

const AdminAssignedOtDetailPage = () => {
  const { planId, empId } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Editable override fields for leader confirm
  const [checkInOverride, setCheckInOverride] = useState('');
  const [checkOutOverride, setCheckOutOverride] = useState('');
  const [compMethod, setCompMethod] = useState('');

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchAssignment = async () => {
    try {
      setLoading(true);
      const data = await otService.getOtPlanEmployee(empId);
      setAssignment(data);
      // Pre-fill override fields from existing checkin data
      if (data.checkin?.checkInAt) setCheckInOverride(toInputDateTime(data.checkin.checkInAt));
      if (data.checkin?.checkOutAt) setCheckOutOverride(toInputDateTime(data.checkin.checkOutAt));
      if (data.checkin?.compensatoryMethod) setCompMethod(data.checkin.compensatoryMethod);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load assignment details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignment();
  }, [empId]);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await otService.approveCheckin(assignment.checkin.id, assignment.checkin.version, {
        checkInAt: checkInOverride ? `${checkInOverride}:00+07:00` : undefined,
        checkOutAt: checkOutOverride ? `${checkOutOverride}:00+07:00` : undefined,
        compensatoryMethod: compMethod || undefined,
      });
      toast.success('Check-in confirmed successfully');
      navigate(`/ot-management/${planId}`);
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Record has been modified. Refreshing...');
        fetchAssignment();
      } else {
        toast.error(error.response?.data?.message || 'Failed to confirm check-in');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason || rejectReason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }
    try {
      setSubmitting(true);
      await otService.rejectCheckin(assignment.checkin.id, rejectReason, assignment.checkin.version);
      toast.success('Check-in rejected');
      setShowRejectModal(false);
      navigate(`/ot-management/${planId}`);
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Record has been modified. Refreshing...');
        setShowRejectModal(false);
        fetchAssignment();
      } else {
        toast.error(error.response?.data?.message || 'Failed to reject check-in');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
          onClick={() => navigate(`/ot-management/${planId}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm mt-4"
        >
          Back to OT Plan
        </button>
      </div>
    );
  }

  const { checkin, status, employee } = assignment;

  const showCheckin = ['checked_in', 'checked_out', 'confirmed', 'rejected'].includes(status);
  const showCheckout = ['checked_out', 'confirmed', 'rejected'].includes(status);
  const showActualDuration = ['checked_out', 'confirmed'].includes(status);
  const showOutcome = ['checked_in', 'checked_out', 'confirmed', 'rejected'].includes(status);
  // Leader can act when checkin is checked_out or missed
  const canAct = checkin && ['checked_out', 'missed'].includes(status);

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
      : checkin?.compensatoryMethod === 'OVERTIME_PAY'
      ? 'Overtime Pay'
      : checkin?.compensatoryMethod === 'COMP_LEAVE'
      ? 'Compensatory Leave'
      : '—';

  const avatarInitial = (employee?.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header / Breadcrumb ──────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <nav className="flex items-center gap-1 text-sm text-gray-500 mb-1">
            <Link to="/ot-management" className="hover:text-blue-600 transition-colors">
              OT Management
            </Link>
            <span className="mx-1">›</span>
            <Link to={`/ot-management/${planId}`} className="hover:text-blue-600 transition-colors">
              View OT Plan
            </Link>
            <span className="mx-1">›</span>
            <span className="text-gray-900 font-medium">View Assigned OT Detail</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">Assigned OT Detail</h1>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* ── Employee Information ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Employee Information</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xl font-semibold shrink-0">
            {avatarInitial}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{employee?.username || '—'}</p>
            {employee?.employeeId && (
              <p className="text-sm text-gray-500">ID: {employee.employeeId}</p>
            )}
            {(employee?.departmentName || employee?.position) && (
              <p className="text-sm text-gray-500">
                {[employee.departmentName, employee.position].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
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

          <div className="mb-5">
            <p className="text-sm text-gray-500 mb-1">Work Output</p>
            <p className="text-sm text-gray-900">{checkin?.workOutput || '—'}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-1">OT Benefits</p>
            <p className="text-sm text-gray-900">{benefitLabel}</p>
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

      {/* ── Adjust Actual Times ──────────────────────────────── */}
      {canAct && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Adjust Actual Times</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Check-in Time</label>
              <input
                type="datetime-local"
                value={checkInOverride}
                onChange={(e) => setCheckInOverride(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Check-out Time</label>
              <input
                type="datetime-local"
                value={checkOutOverride}
                onChange={(e) => setCheckOutOverride(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Compensatory Method</label>
              <select
                value={compMethod}
                onChange={(e) => setCompMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="COMP_LEAVE">Compensatory Leave</option>
                <option value="OVERTIME_PAY">Overtime Pay</option>
                <option value="NONE">None</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer Buttons ───────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(`/ot-management/${planId}`)}
          className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        {canAct && (
          <>
            <button
              onClick={() => { setRejectReason(''); setShowRejectModal(true); }}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {submitting && <LoadingSpinner size="sm" />}
              <CheckCircle className="w-4 h-4" />
              {submitting ? 'Confirming...' : 'Confirm'}
            </button>
          </>
        )}
      </div>

      {/* ── Reject Modal ─────────────────────────────────────── */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Check-in"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Rejection *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a detailed reason..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">Minimum 10 characters</p>
                <p className={`text-xs ${
                  rejectReason.length > 450 ? 'text-amber-500' : rejectReason.length < 10 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {rejectReason.length}/500
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submitting || rejectReason.trim().length < 10}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              >
                {submitting && <LoadingSpinner size="sm" />}
                {submitting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminAssignedOtDetailPage;
