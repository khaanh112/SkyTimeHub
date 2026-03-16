import { useState, useEffect, useMemo, Fragment } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { otService } from '../services';
import { LoadingSpinner, Modal } from '../components';
import { useAuth } from '../context';
import { toast } from 'react-toastify';
import { fmtDateTime } from '../utils/date';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Info,
  User,
  Calendar,
  FileText,
  Play,
  Square,
  ChevronDown,
  Eye,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────

const fmtMinutes = (minutes) => {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

// ── Status Badges ───────────────────────────────────────────────────────

const PlanStatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending' },
    approved: { bg: 'bg-green-50 text-green-700 border-green-200', label: 'Approved' },
    rejected: { bg: 'bg-red-50 text-red-700 border-red-200', label: 'Rejected' },
    cancelled: { bg: 'bg-gray-50 text-gray-600 border-gray-200', label: 'Cancelled' },
  };
  const c = config[status?.toLowerCase()] || config.pending;
  return (
    <span className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full border ${c.bg}`}>
      {c.label}
    </span>
  );
};

const CheckinStatusBadge = ({ status }) => {
  const config = {
    pending: { color: 'text-amber-600', label: 'Pending' },
    checked_in: { color: 'text-blue-600', label: 'Checked In' },
    checked_out: { color: 'text-purple-600', label: 'Checked Out' },
    leader_approved: { color: 'text-green-600', label: 'Approved' },
    leader_rejected: { color: 'text-red-500', label: 'Rejected' },
    missed: { color: 'text-gray-500', label: 'Missed' },
  };
  const c = config[status?.toLowerCase()] || config.pending;
  return <span className={`text-sm font-semibold ${c.color}`}>{c.label}</span>;
};

// ── Section Number ──────────────────────────────────────────────────────

const SectionNumber = ({ num }) => (
  <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">
    {num}
  </div>
);

// ── Compensatory Method Selector ────────────────────────────────────────

const CompMethodSelector = ({ value, onChange }) => {
  const options = [
    { value: 'COMP_LEAVE', label: 'Compensatory Leave' },
    { value: 'OVERTIME_PAY', label: 'Overtime Pay' },
    { value: 'NONE', label: 'None' },
  ];
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────

const OtPlanDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') || 'personal';
  const { user: currentUser } = useAuth();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null); // 'plan' or { checkinId, version }
  const [rejectedReason, setRejectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cancel confirmation modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Checkout modal
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [workOutput, setWorkOutput] = useState('');
  const [compensatoryMethod, setCompensatoryMethod] = useState('');

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const data = await otService.getOtPlan(id);
      setPlan(data);
    } catch (err) {
      console.error('Error fetching OT plan:', err);
      setError('Failed to load OT plan');
      toast.error('Failed to load OT plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [id]);

  const groupedEmployees = useMemo(() => {
    const map = new Map();
    for (const emp of plan?.employees || []) {
      const empId = emp.employeeId || emp.employee?.id;
      if (!map.has(empId)) {
        map.set(empId, {
          employeeId: empId,
          name: emp.employee?.username || emp.employeeName || '—',
          tasks: [],
        });
      }
      map.get(empId).tasks.push(emp);
    }
    return [...map.values()];
  }, [plan?.employees]);

  // ── Plan-level actions ─────────────────────────────────────

  const handleApprovePlan = async () => {
    if (!window.confirm('Are you sure you want to APPROVE this OT plan?')) return;
    try {
      setSubmitting(true);
      await otService.approveOtPlan(plan.id, plan.version);
      toast.success('OT plan approved!');
      fetchPlan();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Plan has been modified. Refreshing...');
        fetchPlan();
      } else {
        toast.error(error.response?.data?.message || 'Failed to approve');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectPlan = () => {
    setRejectTarget('plan');
    setRejectedReason('');
    setShowRejectModal(true);
  };

  const handleCancelPlan = () => {
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    try {
      setSubmitting(true);
      await otService.cancelOtPlan(plan.id);
      toast.success('OT plan cancelled');
      setShowCancelModal(false);
      fetchPlan();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Check-in/out actions ───────────────────────────────────

  const handleCheckin = async (otPlanEmployeeId) => {
    try {
      setSubmitting(true);
      await otService.checkin(otPlanEmployeeId);
      toast.success('Checked in successfully');
      fetchPlan();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to check in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutOpen = (checkin) => {
    setCheckoutTarget(checkin);
    setWorkOutput('');
    setCompensatoryMethod('');
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async () => {
    try {
      setSubmitting(true);
      await otService.checkout(
        checkoutTarget.id,
        workOutput || undefined,
        compensatoryMethod || undefined,
        checkoutTarget.version
      );
      toast.success('Checked out successfully');
      setShowCheckoutModal(false);
      fetchPlan();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Record has been modified. Refreshing...');
        setShowCheckoutModal(false);
        fetchPlan();
      } else {
        toast.error(error.response?.data?.message || 'Failed to check out');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveCheckin = async (checkin) => {
    try {
      setSubmitting(true);
      await otService.approveCheckin(checkin.id, checkin.version);
      toast.success('Check-in approved');
      fetchPlan();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Record has been modified. Refreshing...');
        fetchPlan();
      } else {
        toast.error(error.response?.data?.message || 'Failed to approve check-in');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectCheckin = (checkin) => {
    setRejectTarget({ checkinId: checkin.id, version: checkin.version });
    setRejectedReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectedReason || rejectedReason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }
    try {
      setSubmitting(true);
      if (rejectTarget === 'plan') {
        await otService.rejectOtPlan(plan.id, rejectedReason, plan.version);
        toast.success('OT plan rejected');
      } else {
        await otService.rejectCheckin(rejectTarget.checkinId, rejectedReason, rejectTarget.version);
        toast.success('Check-in rejected');
      }
      setShowRejectModal(false);
      fetchPlan();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Record has been modified. Refreshing...');
        setShowRejectModal(false);
        fetchPlan();
      } else {
        toast.error(error.response?.data?.message || 'Failed to reject');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error states ─────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-500">Loading OT plan details...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
        <p className="text-sm text-gray-500 mb-4">{error || 'Plan not found'}</p>
        <button
          onClick={() => navigate('/ot-management')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to OT Management
        </button>
      </div>
    );
  }

  const { permissions } = plan;
  const isCreator = plan.creatorId === currentUser?.id;
  const isApproved = plan.status === 'approved';
  const isPending = plan.status === 'pending';

  return (
    <div className="w-full">
      {/* Header / Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/ot-management')}
          className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to OT Management</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{plan.code}</h1>
              <PlanStatusBadge status={plan.status} />
            </div>
            <p className="text-sm text-gray-600 mt-1">{plan.title}</p>
          </div>
        </div>
      </div>

      {/* ── Section 1: General Information ─────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <SectionNumber num={1} />
            <h3 className="text-base font-semibold text-gray-900">General Information</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Title</label>
              <p className="text-sm text-gray-900 font-medium">{plan.title}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Creator</label>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {plan.creator?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm text-gray-900">{plan.creator?.username || '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Approver</label>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {plan.approver?.username?.charAt(0).toUpperCase() || 'A'}
                </div>
                <span className="text-sm text-gray-900">{plan.approver?.username || '—'}</span>
              </div>
            </div>
            {plan.description && (
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description</label>
                <p className="text-sm text-gray-700">{plan.description}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Duration</label>
              <div className="flex items-center gap-1.5 text-sm text-gray-900 font-medium">
                <Clock className="w-4 h-4 text-gray-400" />
                {fmtMinutes(plan.totalDurationMinutes)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Employees</label>
              <p className="text-sm text-gray-900">{groupedEmployees.length} employee{groupedEmployees.length !== 1 ? 's' : ''} · {plan.employees?.length || 0} task{(plan.employees?.length || 0) !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created</label>
              <p className="text-sm text-gray-700">{fmtDateTime(plan.createdAt)}</p>
            </div>
          </div>

          {plan.status === 'rejected' && plan.rejectedReason && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                  <p className="text-sm text-red-700 mt-1">{plan.rejectedReason}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Employee Details ────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <SectionNumber num={2} />
            <h3 className="text-base font-semibold text-gray-900">Employee Details</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Duration</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Task</th>
                {isApproved && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actual Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-in Status</th>
                    {permissions?.canManageCheckins && (
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </>
                )}
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedEmployees.map((group, empIdx) => (
                <Fragment key={group.employeeId}>
                  {/* Employee group header row */}
                  <tr className="bg-gray-50/70 border-t-2 border-gray-200">
                    <td colSpan={20} className="px-6 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium w-5 text-center">{empIdx + 1}</span>
                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-xs font-semibold">
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                        {group.tasks.length > 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {group.tasks.length} tasks
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Task rows */}
                  {group.tasks.map((emp, taskIdx) => {
                    const checkin = emp.checkins?.[0] || emp.checkin;
                    const isCurrentEmployee = emp.employeeId === currentUser?.id || emp.employee?.id === currentUser?.id;
                    return (
                      <tr key={emp.id || taskIdx} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 text-xs text-gray-400 font-medium">└ {taskIdx + 1}</td>
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{fmtDateTime(emp.startTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{fmtDateTime(emp.endTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{fmtMinutes(emp.durationMinutes)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-[200px] truncate">{emp.plannedTask}</td>
                        {isApproved && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                              {checkin?.actualDurationMinutes != null ? fmtMinutes(checkin.actualDurationMinutes) : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {checkin ? <CheckinStatusBadge status={checkin.status} /> : <span className="text-gray-400 text-sm">—</span>}
                            </td>
                            {permissions?.canManageCheckins && (
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isCurrentEmployee && checkin?.status === 'pending' && (
                                    <button
                                      onClick={() => handleCheckin(emp.id)}
                                      disabled={submitting}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                                      title="Check In"
                                    >
                                      <Play className="w-3 h-3" /> Check In
                                    </button>
                                  )}
                                  {isCurrentEmployee && checkin?.status === 'checked_in' && (
                                    <button
                                      onClick={() => handleCheckoutOpen(checkin)}
                                      disabled={submitting}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-600 rounded text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                                      title="Check Out"
                                    >
                                      <Square className="w-3 h-3" /> Check Out
                                    </button>
                                  )}
                                  {!isCurrentEmployee && checkin?.status === 'checked_out' && (
                                    <>
                                      <button
                                        onClick={() => handleApproveCheckin(checkin)}
                                        disabled={submitting}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                                        title="Approve"
                                      >
                                        <CheckCircle className="w-3 h-3" /> Approve
                                      </button>
                                      <button
                                        onClick={() => handleRejectCheckin(checkin)}
                                        disabled={submitting}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                                        title="Reject"
                                      >
                                        <XCircle className="w-3 h-3" /> Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </>
                        )}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => navigate(`/ot-management/${plan.id}/employees/${emp.id}`)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Action Buttons ────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        {isPending && permissions?.canUpdate && (
          <button
            onClick={() => navigate(`/ot-management/${plan.id}/edit`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <Edit className="w-4 h-4" /> Edit Plan
          </button>
        )}
        {permissions?.canCancel && (
          <button
            onClick={handleCancelPlan}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Cancel Plan
          </button>
        )}
        {isPending && permissions?.canApprove && (
          <button
            onClick={handleApprovePlan}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" /> Approve Plan
          </button>
        )}
        {isPending && permissions?.canReject && (
          <button
            onClick={handleRejectPlan}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Reject Plan
          </button>
        )}
      </div>

      {/* ── Reject Modal ──────────────────────────────────── */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => { setShowRejectModal(false); setRejectedReason(''); setRejectTarget(null); }}
          title={rejectTarget === 'plan' ? 'Reject OT Plan' : 'Reject Check-in'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Rejection *</label>
              <textarea
                value={rejectedReason}
                onChange={(e) => setRejectedReason(e.target.value)}
                placeholder="Please provide a detailed reason..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">Minimum 10 characters</p>
                <p className={`text-xs ${
                  rejectedReason.length > 450 ? 'text-amber-500' : rejectedReason.length < 10 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {rejectedReason.length}/500
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => { setShowRejectModal(false); setRejectedReason(''); setRejectTarget(null); }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submitting || rejectedReason.trim().length < 10}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <LoadingSpinner size="sm" />}
                {submitting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Checkout Modal ────────────────────────────────── */}
      {showCheckoutModal && checkoutTarget && (
        <Modal
          isOpen={showCheckoutModal}
          onClose={() => { setShowCheckoutModal(false); setCheckoutTarget(null); }}
          title="Check Out"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Work Output</label>
              <textarea
                value={workOutput}
                onChange={(e) => setWorkOutput(e.target.value)}
                placeholder="Describe what you accomplished..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Compensatory Method</label>
              <CompMethodSelector
                value={compensatoryMethod}
                onChange={setCompensatoryMethod}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => { setShowCheckoutModal(false); setCheckoutTarget(null); }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckoutSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <LoadingSpinner size="sm" />}
                {submitting ? 'Checking out...' : 'Check Out'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* ── Cancel Confirmation Modal ───────────────────── */}
      {showCancelModal && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Cancel OT plan"
          size="sm"
        >
          <div className="space-y-5">
            <p className="text-sm text-gray-700">Are you sure you want to cancel this OT plan?</p>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
              >
                No
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              >
                {submitting && <LoadingSpinner size="sm" />}
                {submitting ? 'Cancelling...' : 'Yes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OtPlanDetailPage;
