import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { LoadingSpinner, Modal } from '../components';
import { toast } from 'react-toastify';
import {
  Calendar,
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
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Format YYYY-MM-DD → DD/MM/YYYY */
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

/** Format ID as #LV-001 */
const fmtId = (id) => `#LV-${String(id).padStart(3, '0')}`;

/** Format duration_days as "X Day(s)" */
const fmtDuration = (days) => {
  if (days == null) return '-';
  const n = Number(days);
  if (n === 0.5) return '0.5 Day';
  if (n === 1) return '1 Day';
  return `${n % 1 === 0 ? n : n} Days`;
};

/**
 * Build display string for Leave Type from items + requestedLeaveType.
 * e.g. "Policy Leave + Paid Leave", "Paid Leave", "Sick Leave"
 */
const getLeaveTypeDisplay = (request) => {
  const items = request.items || [];
  if (items.length > 1) {
    const names = items.map((item) => item.leaveType?.name || item.note || 'Unknown');
    return [...new Set(names)].join(' + ');
  }
  if (items.length === 1) {
    return items[0].leaveType?.name || items[0].note || 'Unknown';
  }
  return request.requestedLeaveType?.name || 'Unknown';
};

// ── Status Badge (plain coloured text, matching screenshot) ─────────────

const StatusBadge = ({ status, rejectedReason }) => {
  const config = {
    pending: { color: 'text-amber-600', label: 'Pending' },
    approved: { color: 'text-green-600', label: 'Approved' },
    rejected: { color: 'text-red-500', label: 'Rejected' },
    cancelled: { color: 'text-gray-500', label: 'Cancelled' },
    canceled: { color: 'text-gray-500', label: 'Cancelled' },
    done: { color: 'text-blue-600', label: 'Completed' },
  };
  const c = config[status?.toLowerCase()] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${c.color}`}>
      {c.label}
      {status === 'rejected' && rejectedReason && (
        <span title={rejectedReason}>
          <Info className="w-4 h-4 text-blue-500 cursor-help" />
        </span>
      )}
    </span>
  );
};

// ── 3-dot Action Menu ───────────────────────────────────────────────────

const ActionMenu = ({ request, onEdit, onCancel, onApprove, onReject, view }) => {
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

  if (view === 'my-requests') {
    if (request.status === 'pending') {
      items.push({ icon: Edit, label: 'Update', onClick: () => onEdit(request) });
      items.push({ icon: Trash2, label: 'Cancel', onClick: () => onCancel(request.id), danger: true });
    }
    if (request.status === 'approved') {
      items.push({ icon: Trash2, label: 'Cancel', onClick: () => onCancel(request.id), danger: true });
    }
  }

  if (view === 'management' && request.status === 'pending') {
    items.push({ icon: CheckCircle, label: 'Approve', onClick: () => onApprove(request), success: true });
    items.push({ icon: XCircle, label: 'Reject', onClick: () => onReject(request), danger: true });
  }

  if (items.length === 0) return <span className="text-gray-300">—</span>;

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

const LeaveRequestManagementPage = () => {
  const navigate = useNavigate();

  // Data
  const [view, setView] = useState('my-requests');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaveCategories, setLeaveCategories] = useState([]);

  // Filters
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
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

  // ── Data loading ───────────────────────────────────────────
  useEffect(() => { fetchData(); }, [view]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, typeRes] = await Promise.all([
        view === 'my-requests'
          ? leaveRequestService.getMyLeaveRequests()
          : leaveRequestService.getManagementRequests(),
        leaveCategories.length === 0 ? leaveRequestService.getLeaveTypes() : Promise.resolve(null),
      ]);
      setLeaveRequests(reqRes.data || reqRes);
      if (typeRes) setLeaveCategories(typeRes.data || typeRes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [leaveTypeFilter, statusFilter, dateFrom, dateTo, view]);

  // ── Build flat list of leave type names for the filter dropdown ─────
  const allLeaveTypeNames = useMemo(() => {
    const names = new Set();
    leaveCategories.forEach((cat) => {
      (cat.leaveTypes || []).forEach((lt) => names.add(lt.name));
    });
    return [...names].sort();
  }, [leaveCategories]);

  // ── Filtered data ──────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    let data = [...leaveRequests];

    // Leave type filter
    if (leaveTypeFilter !== 'all') {
      data = data.filter((r) => {
        const display = getLeaveTypeDisplay(r).toLowerCase();
        return display.includes(leaveTypeFilter.toLowerCase());
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      data = data.filter((r) => {
        const s = r.status?.toLowerCase();
        return s === statusFilter || (statusFilter === 'cancelled' && s === 'canceled');
      });
    }

    // Date range
    if (dateFrom) data = data.filter((r) => r.startDate >= dateFrom);
    if (dateTo) data = data.filter((r) => r.endDate <= dateTo);

    return data;
  }, [leaveRequests, leaveTypeFilter, statusFilter, dateFrom, dateTo]);

  // ── Paginated slice ────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / rowsPerPage));
  const paginatedRequests = filteredRequests.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );

  // ── Actions ────────────────────────────────────────────────
  const handleEdit = (request) => navigate(`/leave-requests/${request.id}/edit`);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await leaveRequestService.cancelLeaveRequest(id);
      toast.success('Leave request cancelled successfully');
      fetchData();
    } catch (error) {
      const data = error.response?.data;
      if (data?.details?.length) data.details.forEach((m) => toast.error(m));
      else toast.error(data?.message || 'Failed to cancel leave request');
    }
  };

  const handleApprove = async (request) => {
    if (processingId) return;
    if (!window.confirm('Are you sure you want to APPROVE this leave request?')) return;
    try {
      setProcessingId(request.id);
      await leaveRequestService.approveLeaveRequest(request.id, request.version);
      toast.success('Leave request approved successfully!');
      fetchData();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing...');
        fetchData();
      } else {
        const data = error.response?.data;
        if (data?.details?.length) data.details.forEach((m) => toast.error(m));
        else toast.error(data?.message || 'Failed to approve leave request');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
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
      setProcessingId(selectedRequest.id);
      await leaveRequestService.rejectLeaveRequest(selectedRequest.id, rejectedReason, selectedRequest.version);
      toast.success('Leave request rejected');
      setShowRejectModal(false);
      fetchData();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing...');
        setShowRejectModal(false);
        fetchData();
      } else {
        const data = error.response?.data;
        if (data?.details?.length) data.details.forEach((m) => toast.error(m));
        else toast.error(data?.message || 'Failed to reject leave request');
      }
    } finally {
      setSubmitting(false);
      setProcessingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-500">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  const viewLabel = view === 'my-requests' ? 'Personal view' : 'Management view';

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
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
                  onClick={() => { setView('my-requests'); setShowViewDropdown(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    view === 'my-requests'
                      ? 'font-bold text-gray-900 bg-gray-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Personal view
                </button>
                <button
                  onClick={() => { setView('management'); setShowViewDropdown(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    view === 'management'
                      ? 'font-bold text-gray-900 bg-gray-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Management view
                </button>
              </div>
            )}
          </div>

          {/* Create Button */}
          {view === 'my-requests' && (
            <button
              onClick={() => navigate('/leave-requests/create')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Request
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        {/* Leave Type Filter */}
        <select
          value={leaveTypeFilter}
          onChange={(e) => setLeaveTypeFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
        >
          <option value="all">Leave Type: All</option>
          {allLeaveTypeNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

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
            placeholder="Start"
          />
          <span className="text-gray-400">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm text-gray-700 border-none focus:outline-none bg-transparent w-[130px]"
            placeholder="End"
          />
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-full mb-4">
              <Calendar className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No leave requests found</h3>
            <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
              {view === 'my-requests'
                ? 'Create your first leave request to get started.'
                : 'No requests match the current filters.'}
            </p>
            {view === 'my-requests' && (
              <button
                onClick={() => navigate('/leave-requests/create')}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Request
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave Type</th>
                    {view === 'management' && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requester</th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Approver</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/leave-requests/${request.id}${view === 'management' ? '?view=management' : ''}`)}
                    >
                      {/* ID */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {fmtId(request.id)}
                      </td>

                      {/* Leave Type */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {getLeaveTypeDisplay(request)}
                      </td>

                      {/* Requester — management only */}
                      {view === 'management' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {request.user?.username || 'Unknown'}
                        </td>
                      )}

                      {/* Start Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {fmtDate(request.startDate)}
                      </td>

                      {/* End Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {fmtDate(request.endDate)}
                      </td>

                      {/* Duration */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {fmtDuration(request.durationDays)}
                      </td>

                      {/* Approver */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {request.approver?.username || 'N/A'}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={request.status} rejectedReason={request.rejectedReason} />
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          request={request}
                          view={view}
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

            {/* ── Pagination ─────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
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
                  .filter((p) => {
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - page) <= 1;
                  })
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === '...' ? (
                      <span key={`e-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          page === item
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
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
      {showRejectModal && selectedRequest && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => { setShowRejectModal(false); setRejectedReason(''); setSelectedRequest(null); }}
          title="Reject Leave Request"
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Employee:</strong> {selectedRequest.user?.username || 'Unknown'}
              </p>
              <p className="text-sm text-yellow-800">
                <strong>Period:</strong> {fmtDate(selectedRequest.startDate)} – {fmtDate(selectedRequest.endDate)}
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
                <p className={`text-xs ${rejectedReason.length > 450 ? 'text-amber-500' : rejectedReason.length < 10 ? 'text-red-400' : 'text-gray-400'}`}>
                  {rejectedReason.length}/500
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => { setShowRejectModal(false); setRejectedReason(''); setSelectedRequest(null); }}
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
                {submitting ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LeaveRequestManagementPage;
