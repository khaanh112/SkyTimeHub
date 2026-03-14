import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { otService, departmentService } from '../services';
import { useAuth } from '../context';
import { LoadingSpinner, Modal } from '../components';
import { toast } from 'react-toastify';
import { fmtDate, fmtDateTime } from '../utils/date';
import {
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  ChevronDown,
  Search,
  FileText,
  Eye,
  Calendar,
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

// ── Status Badge ────────────────────────────────────────────────────────

const StatusBadge = ({ status, rejectedReason, checkinInfo }) => {
  const config = {
    pending: { color: 'text-amber-600', label: 'Pending' },
    approved: { color: 'text-green-600', label: 'Approved' },
    rejected: { color: 'text-red-500', label: 'Rejected' },
    cancelled: { color: 'text-gray-500', label: 'Cancelled' },
  };
  const c = config[status?.toLowerCase()] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${c.color}`}>
      {c.label}
      {checkinInfo && status === 'approved' && (
        <span className="text-xs font-normal text-gray-500">
          ({checkinInfo})
        </span>
      )}
      {status === 'rejected' && rejectedReason && (
        <span title={rejectedReason}>
          <Info className="w-4 h-4 text-blue-500 cursor-help" />
        </span>
      )}
    </span>
  );
};

// ── 3-dot Action Menu ───────────────────────────────────────────────────

const ActionMenu = ({ plan, onView, onEdit, onCancel, onApprove, onReject, view }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = [];
  const { permissions } = plan;

  items.push({ icon: Eye, label: 'View', onClick: () => onView(plan) });

  if (view === 'personal') {
    if (permissions?.canUpdate)
      items.push({ icon: Edit, label: 'Update', onClick: () => onEdit(plan) });
    if (permissions?.canCancel)
      items.push({ icon: Trash2, label: 'Cancel', onClick: () => onCancel(plan.id), danger: true });
  }

  if (view === 'management') {
    if (permissions?.canApprove)
      items.push({ icon: CheckCircle, label: 'Approve', onClick: () => onApprove(plan), success: true });
    if (permissions?.canReject)
      items.push({ icon: XCircle, label: 'Reject', onClick: () => onReject(plan), danger: true });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreHorizontal className="w-5 h-5 text-gray-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : item.success
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Assigned OT Status Badge ────────────────────────────────────────────

const AssignedOtStatusBadge = ({ status }) => {
  const config = {
    approved:    { bg: 'bg-blue-50',   text: 'text-blue-800',   label: 'Approved' },
    checked_in:  { bg: 'bg-purple-50', text: 'text-purple-800', label: 'Checked In' },
    checked_out: { bg: 'bg-indigo-50', text: 'text-indigo-800', label: 'Checked Out' },
    confirmed:   { bg: 'bg-teal-50',   text: 'text-teal-800',   label: 'Confirmed' },
    rejected:    { bg: 'bg-red-50',    text: 'text-red-800',    label: 'Rejected' },
    missed:      { bg: 'bg-red-50',    text: 'text-red-800',    label: 'Missed' },
    cancelled:   { bg: 'bg-gray-50',   text: 'text-gray-600',   label: 'Cancelled' },
  };
  const c = config[status?.toLowerCase()] || { bg: 'bg-gray-50', text: 'text-gray-600', label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

// ── Personal view 3-dot Action Menu ─────────────────────────────────────

const PersonalActionMenu = ({ item, onView, onCheckin, onCheckout }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const items = [{ icon: Eye, label: 'View', onClick: onView }];
  if (item.status === 'approved')    items.push({ icon: CheckCircle, label: 'Check In',  onClick: onCheckin });
  if (item.status === 'checked_in')  items.push({ icon: XCircle,     label: 'Check Out', onClick: onCheckout });

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreHorizontal className="w-5 h-5 text-gray-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-4 h-4" />
                {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Pagination Controls ──────────────────────────────────────────────────

const PaginationControls = ({ page, totalPages, setPage }) => (
  <div className="flex items-center gap-1">
    <button
      onClick={() => setPage(Math.max(1, page - 1))}
      disabled={page === 1}
      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
    {Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
      .reduce((acc, p, idx, arr) => {
        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
        acc.push(p);
        return acc;
      }, [])
      .map((item, i) =>
        item === '...' ? (
          <span key={`e-${i}`} className="px-2 text-gray-400 text-sm">...</span>
        ) : (
          <button
            key={item}
            onClick={() => setPage(item)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
              page === item ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item}
          </button>
        ),
      )}
    <button
      onClick={() => setPage(Math.min(totalPages, page + 1))}
      disabled={page === totalPages}
      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>
);

// ── Main Page ───────────────────────────────────────────────────────────

const OTManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'admin' || user?.role === 'hr';
  const isDeptLeader = user?.role === 'employee' && user?.position === 'Department leader';
  const canAccessManagement = isAdminOrHR || isDeptLeader;

  // ── View & data
  const [view, setView] = useState('personal'); // 'personal' | 'management'
  const [otPlans, setOtPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Department filter (admin/HR only)
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState('all');

  // ── Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Personal view specific state
  const [myAssignments, setMyAssignments] = useState([]);
  const [myTotal, setMyTotal] = useState(0);
  const [otBenefitsFilter, setOtBenefitsFilter] = useState('all');
  const [personalStatusFilter, setPersonalStatusFilter] = useState('all');

  // ── Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [rejectedReason, setRejectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Cancel confirmation modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState(null);

  // Checkout modal (personal view)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [workOutput, setWorkOutput] = useState('');
  const [compensatoryMethod, setCompensatoryMethod] = useState('');

  // View dropdown
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const viewDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target))
        setShowViewDropdown(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch departments for admin/HR department filter
  useEffect(() => {
    if (isAdminOrHR) {
      departmentService.getAll().then((res) => setDepartments(res || [])).catch(() => {});
    }
  }, [isAdminOrHR]);

  // Force regular employees to personal view
  useEffect(() => {
    if (!canAccessManagement) setView('personal');
  }, [canAccessManagement]);

  // ── Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Reset to page 1 when filters / view change
  useEffect(() => {
    setPage(1);
  }, [view, statusFilter, personalStatusFilter, otBenefitsFilter, dateFrom, dateTo, debouncedSearch, pageSize, deptFilter]);

  // ── Fetch management view data
  const fetchMgmtData = useCallback(async () => {
    if (view !== 'management') return;
    try {
      setLoading(true);
      const res = await otService.getOtPlansList({
        view,
        page,
        pageSize,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        q: debouncedSearch || undefined,
        departmentId: isAdminOrHR && deptFilter !== 'all' ? deptFilter : undefined,
      });
      setOtPlans(res.data || []);
      setTotal(res.page?.total ?? 0);
    } catch (err) {
      console.error('Error fetching OT plans:', err);
      toast.error('Failed to load OT plans');
    } finally {
      setLoading(false);
    }
  }, [view, page, pageSize, statusFilter, dateFrom, dateTo, debouncedSearch, isAdminOrHR, deptFilter]);

  // ── Fetch personal view data
  const fetchMyData = useCallback(async () => {
    if (view !== 'personal') return;
    try {
      setLoading(true);
      const res = await otService.getMyAssignments({
        page,
        pageSize,
        status: personalStatusFilter !== 'all' ? personalStatusFilter : undefined,
        otBenefits: otBenefitsFilter !== 'all' ? otBenefitsFilter : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setMyAssignments(res.data || []);
      setMyTotal(res.page?.total ?? 0);
    } catch (err) {
      console.error('Error fetching assigned OT:', err);
      toast.error('Failed to load assigned OT');
    } finally {
      setLoading(false);
    }
  }, [view, page, pageSize, personalStatusFilter, otBenefitsFilter, dateFrom, dateTo]);

  useEffect(() => { fetchMgmtData(); }, [fetchMgmtData]);
  useEffect(() => { fetchMyData(); }, [fetchMyData]);

  const totalPages = Math.max(1, Math.ceil((view === 'personal' ? myTotal : total) / pageSize));

  // ── Management view actions
  const handleView = (plan) => navigate(`/ot-management/${plan.id}?view=management`);
  const handleEdit = (plan) => navigate(`/ot-management/${plan.id}/edit`);

  const handleCancel = (id) => {
    setCancelTargetId(id);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTargetId) return;
    try {
      setSubmitting(true);
      await otService.cancelOtPlan(cancelTargetId);
      toast.success('OT plan cancelled successfully');
      setShowCancelModal(false);
      setCancelTargetId(null);
      fetchMgmtData();
    } catch (error) {
      const data = error.response?.data;
      if (data?.details?.length) data.details.forEach((m) => toast.error(m));
      else toast.error(data?.message || 'Failed to cancel OT plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (plan) => {
    if (processingId) return;
    if (!window.confirm('Are you sure you want to APPROVE this OT plan?')) return;
    try {
      setProcessingId(plan.id);
      await otService.approveOtPlan(plan.id, plan.version);
      toast.success('OT plan approved successfully!');
      fetchMgmtData();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('This plan has been modified. Refreshing...');
        fetchMgmtData();
      } else {
        const data = error.response?.data;
        if (data?.details?.length) data.details.forEach((m) => toast.error(m));
        else toast.error(data?.message || 'Failed to approve OT plan');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (plan) => {
    setSelectedPlan(plan);
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
      setProcessingId(selectedPlan.id);
      await otService.rejectOtPlan(selectedPlan.id, rejectedReason, selectedPlan.version);
      toast.success('OT plan rejected');
      setShowRejectModal(false);
      fetchMgmtData();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('This plan has been modified. Refreshing...');
        setShowRejectModal(false);
        fetchMgmtData();
      } else {
        const data = error.response?.data;
        if (data?.details?.length) data.details.forEach((m) => toast.error(m));
        else toast.error(data?.message || 'Failed to reject OT plan');
      }
    } finally {
      setSubmitting(false);
      setProcessingId(null);
    }
  };

  const handleExport = async () => {
    try {
      await otService.exportReport({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        q: debouncedSearch || undefined,
      });
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to export report');
    }
  };

  // ── Personal view actions
  const handleCheckin = async (assignment) => {
    try {
      await otService.checkin(assignment.id);
      toast.success('Checked in successfully');
      fetchMyData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to check in');
    }
  };

  const handleCheckoutOpen = (assignment) => {
    setCheckoutTarget(assignment);
    setWorkOutput('');
    setCompensatoryMethod('');
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async () => {
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
        checkoutTarget.checkin.id,
        workOutput,
        compensatoryMethod,
        checkoutTarget.checkin.version,
      );
      toast.success('Checked out successfully');
      setShowCheckoutModal(false);
      fetchMyData();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Record has been modified. Refreshing...');
        setShowCheckoutModal(false);
        fetchMyData();
      } else {
        toast.error(error.response?.data?.message || 'Failed to check out');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render
  const viewLabel = view === 'personal' ? 'Personal view' : 'Management view';

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">OT Management</h1>
        <div className="flex items-center gap-3">
          {/* View Selector — only for admin/HR/dept leader */}
          {canAccessManagement && (
            <div className="relative" ref={viewDropdownRef}>
              <button
                onClick={() => setShowViewDropdown(!showViewDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-w-[200px] justify-between"
              >
                <span>View: {viewLabel}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showViewDropdown && (
                <div className="absolute right-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
                  <button
                    onClick={() => { setView('personal'); setShowViewDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      view === 'personal' ? 'font-bold text-gray-900 bg-gray-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Personal view
                  </button>
                  <button
                    onClick={() => { setView('management'); setShowViewDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      view === 'management' ? 'font-bold text-gray-900 bg-gray-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Management view
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {view === 'management' && (
            <>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                <FileText className="w-4 h-4" />
                Report
              </button>
              {user?.position === 'Department leader' && (
                <button
                  onClick={() => navigate('/ot-management/create')}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create OT Plan
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────── */}
      {view === 'personal' ? (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* OT Benefits filter */}
          <select
            value={otBenefitsFilter}
            onChange={(e) => setOtBenefitsFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
          >
            <option value="all">OT Benefits: All</option>
            <option value="paid">Paid Overtime</option>
            <option value="comp_leave">Compensatory Leave</option>
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="text-sm text-gray-700 border-none focus:outline-none bg-transparent w-[130px]"
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="text-sm text-gray-700 border-none focus:outline-none bg-transparent w-[130px]"
            />
          </div>

          {/* Status filter */}
          <select
            value={personalStatusFilter}
            onChange={(e) => setPersonalStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
          >
            <option value="all">Status: All</option>
            <option value="approved">Approved</option>
            <option value="checked_in">Checked In</option>
            <option value="checked_out">Checked Out</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="missed">Missed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Department filter — admin/HR only */}
          {isAdminOrHR && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
            >
              <option value="all">Department: All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or employee"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
          >
            <option value="all">Status: All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm text-gray-700 border-none focus:outline-none bg-transparent w-[130px]"
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm text-gray-700 border-none focus:outline-none bg-transparent w-[130px]"
            />
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <LoadingSpinner />
              <p className="mt-4 text-sm text-gray-500">
                {view === 'personal' ? 'Loading assigned OT...' : 'Loading OT plans...'}
              </p>
            </div>
          </div>
        ) : view === 'personal' ? (
          /* ── Personal view table ─────────────────────── */
          myAssignments.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-full mb-4">
                <Clock className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No assigned OT found</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                You have no assigned OT matching the current filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">OT Benefits</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Start Time</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned End Time</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Duration</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actual Duration</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myAssignments.map((item) => {
                      const showBenefits = ['confirmed', 'checked_out', 'rejected'].includes(item.status);
                      const showActualDuration = ['confirmed', 'checked_out'].includes(item.status);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/ot-management/assignments/${item.id}`)}
                        >
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {item.assignedOtId}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                            {showBenefits
                              ? item.compensatoryMethod === 'paid'
                                ? 'Paid Overtime'
                                : item.compensatoryMethod === 'comp_leave'
                                ? 'Compensatory Leave'
                                : '—'
                              : <span className="text-gray-400 italic">--</span>}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                            {fmtDateTime(item.startTime)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                            {fmtDateTime(item.endTime)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                            {fmtMinutes(item.durationMinutes)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                            {showActualDuration
                              ? fmtMinutes(item.actualDurationMinutes)
                              : <span className="text-gray-400 italic font-normal">--</span>}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <AssignedOtStatusBadge status={item.status} />
                          </td>
                          <td
                            className="px-4 py-4 whitespace-nowrap text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PersonalActionMenu
                              item={item}
                              onView={() => navigate(`/ot-management/assignments/${item.id}`)}
                              onCheckin={() => handleCheckin(item)}
                              onCheckout={() => handleCheckoutOpen(item)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
              </div>
            </>
          )
        ) : (
          /* ── Management view table ───────────────────── */
          otPlans.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-full mb-4">
                <Clock className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No OT plans found</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                No plans match the current filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                      {isAdminOrHR && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>}
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employees</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Hours</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {otPlans.map((plan) => (
                      <tr
                        key={plan.id}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => handleView(plan)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {plan.code}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-[200px] truncate">
                          {plan.title}
                        </td>
                        {isAdminOrHR && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {plan.departmentName || '—'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {fmtDate(plan.executionDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {plan.employeeCount ?? plan.employees?.length ?? '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {fmtMinutes(plan.totalDurationMinutes)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge
                            status={plan.status}
                            rejectedReason={plan.rejectedReason}
                            checkinInfo={plan.checkinInfo}
                          />
                        </td>
                        <td
                          className="px-6 py-4 whitespace-nowrap text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ActionMenu
                            plan={plan}
                            view={view}
                            onView={handleView}
                            onEdit={handleEdit}
                            onCancel={handleCancel}
                            onApprove={handleApprove}
                            onReject={handleReject}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />
              </div>
            </>
          )
        )}
      </div>

      {/* ── Reject Modal (management) ─────────────────────────── */}
      {showRejectModal && selectedPlan && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setRejectedReason('');
            setSelectedPlan(null);
          }}
          title="Reject OT Plan"
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Plan:</strong> {selectedPlan.code} — {selectedPlan.title}
              </p>
            </div>
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
                onClick={() => { setShowRejectModal(false); setRejectedReason(''); setSelectedPlan(null); }}
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
                {submitting ? 'Rejecting...' : 'Reject Plan'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Checkout Modal (personal view) ───────────────────── */}
      {showCheckoutModal && checkoutTarget && (
        <Modal
          isOpen={showCheckoutModal}
          onClose={() => { setShowCheckoutModal(false); setCheckoutTarget(null); }}
          title="Check Out"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Output <span className="text-red-500">*</span>
              </label>
              <textarea
                value={workOutput}
                onChange={(e) => setWorkOutput(e.target.value)}
                placeholder="Describe the work you completed..."
                rows={4}
                maxLength={1000}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                OT Benefits <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-6">
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
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => { setShowCheckoutModal(false); setCheckoutTarget(null); }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckoutSubmit}
                disabled={submitting || !workOutput.trim() || !compensatoryMethod}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              >
                {submitting && <LoadingSpinner size="sm" />}
                {submitting ? 'Checking out...' : 'Check Out'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* ── Cancel Confirmation Modal ─────────────────────────── */}
      {showCancelModal && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => { setShowCancelModal(false); setCancelTargetId(null); }}
          title="Cancel OT plan"
          size="sm"
        >
          <div className="space-y-5">
            <p className="text-sm text-gray-700">Are you sure you want to cancel this OT plan?</p>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                onClick={() => { setShowCancelModal(false); setCancelTargetId(null); }}
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

export default OTManagementPage;
