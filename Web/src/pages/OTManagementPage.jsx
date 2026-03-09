import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { otService } from '../services';
import { LoadingSpinner, Modal } from '../components';
import { toast } from 'react-toastify';
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

const fmtDate = (isoStr) => {
  if (!isoStr) return '';
  const m = isoStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoStr;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

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

// ── Main Page ───────────────────────────────────────────────────────────

const OTManagementPage = () => {
  const navigate = useNavigate();

  // ── View & data
  const [view, setView] = useState('personal'); // 'personal' | 'management'
  const [otPlans, setOtPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [rejectedReason, setRejectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

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

  // ── Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Reset to page 1 when filters / view change
  useEffect(() => {
    setPage(1);
  }, [view, statusFilter, dateFrom, dateTo, debouncedSearch, pageSize]);

  // ── Fetch from server
  const fetchData = useCallback(async () => {
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
      });
      setOtPlans(res.data || []);
      setTotal(res.page?.total ?? 0);
    } catch (err) {
      console.error('Error fetching OT plans:', err);
      toast.error('Failed to load OT plans');
    } finally {
      setLoading(false);
    }
  }, [view, page, pageSize, statusFilter, dateFrom, dateTo, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Actions
  const handleView = (plan) => navigate(`/ot-management/${plan.id}${view === 'management' ? '?view=management' : ''}`);
  const handleEdit = (plan) => navigate(`/ot-management/${plan.id}/edit`);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this OT plan?')) return;
    try {
      await otService.cancelOtPlan(id);
      toast.success('OT plan cancelled successfully');
      fetchData();
    } catch (error) {
      const data = error.response?.data;
      if (data?.details?.length) data.details.forEach((m) => toast.error(m));
      else toast.error(data?.message || 'Failed to cancel OT plan');
    }
  };

  const handleApprove = async (plan) => {
    if (processingId) return;
    if (!window.confirm('Are you sure you want to APPROVE this OT plan?')) return;
    try {
      setProcessingId(plan.id);
      await otService.approveOtPlan(plan.id, plan.version);
      toast.success('OT plan approved successfully!');
      fetchData();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('This plan has been modified. Refreshing...');
        fetchData();
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
      fetchData();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('This plan has been modified. Refreshing...');
        setShowRejectModal(false);
        fetchData();
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

  // ── Render
  const viewLabel = view === 'personal' ? 'Personal view' : 'Management view';

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">OT Management</h1>
        <div className="flex items-center gap-3">
          {/* View Selector */}
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

          {/* Action Buttons */}
          {view === 'personal' ? (
            <button
              onClick={() => navigate('/ot-management/create')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create OT Plan
            </button>
          ) : (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search — management view only */}
        {view === 'management' && (
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
        )}

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

      {/* ── Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <LoadingSpinner />
              <p className="mt-4 text-sm text-gray-500">Loading OT plans...</p>
            </div>
          </div>
        ) : otPlans.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-full mb-4">
              <Clock className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No OT plans found</h3>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              {view === 'personal'
                ? 'Create your first OT plan to get started.'
                : 'No plans match the current filters.'}
            </p>
            {view === 'personal' && (
              <button
                onClick={() => navigate('/ot-management/create')}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create OT Plan
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    {view === 'management' && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                    )}
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
                      {view === 'management' && (
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

            {/* ── Pagination ────────────────────────────────── */}
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
            </div>
          </>
        )}
      </div>

      {/* ── Reject Modal ─────────────────────────────────────── */}
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
    </div>
  );
};

export default OTManagementPage;
