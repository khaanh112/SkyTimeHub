import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { LoadingSpinner, Modal } from '../components';
import { toast } from 'react-toastify';
import { 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Plus, 
  MoreVertical,
  User,
  Search
} from 'lucide-react';

const LeaveRequestManagementPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('my-requests'); // 'my-requests' | 'management'
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectedReason, setRejectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  useEffect(() => {
    fetchLeaveRequests();
  }, [view]);

  useEffect(() => {
    applyFilters();
  }, [leaveRequests, searchQuery, statusFilter, startDateFilter, endDateFilter]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const data = view === 'my-requests' 
        ? await leaveRequestService.getMyLeaveRequests()
        : await leaveRequestService.getPendingApprovals();
      setLeaveRequests(data.data || data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leaveRequests];

    // Search filter (by name or reason)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(request => {
        const userName = request.user?.username?.toLowerCase() || '';
        const reason = request.reason?.toLowerCase() || '';
        return userName.includes(query) || reason.includes(query);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => {
        // Handle both "canceled" and "cancelled" spellings
        const requestStatus = request.status?.toLowerCase();
        const filterStatus = statusFilter.toLowerCase();
        return requestStatus === filterStatus || 
               (filterStatus === 'cancelled' && requestStatus === 'canceled') ||
               (filterStatus === 'canceled' && requestStatus === 'cancelled');
      });
    }

    // Date range filter
    if (startDateFilter) {
      filtered = filtered.filter(request => 
        new Date(request.startDate) >= new Date(startDateFilter)
      );
    }
    if (endDateFilter) {
      filtered = filtered.filter(request => 
        new Date(request.endDate) <= new Date(endDateFilter)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleCancel = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      await leaveRequestService.cancelLeaveRequest(id);
      toast.success('Leave request cancelled successfully');
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error cancelling leave request:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel leave request');
    }
  };

  const handleEdit = (request, event) => {
    event.stopPropagation();
    navigate(`/leave-requests/${request.id}/edit`);
  };

  const handleApprove = async (request, event) => {
    event.stopPropagation();
    setOpenMenuId(null);
    
    if (processingId) return;
    if (!window.confirm('Are you sure you want to APPROVE this leave request?')) {
      return;
    }

    try {
      setProcessingId(request.id);
      await leaveRequestService.approveLeaveRequest(request.id, request.version);
      toast.success('Leave request approved successfully!');
      setLeaveRequests(prev => prev.filter(r => r.id !== request.id));
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error approving leave request:', error);
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing data...');
        fetchLeaveRequests();
      } else {
        toast.error(error.response?.data?.message || 'Failed to approve leave request');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (request, event) => {
    event.stopPropagation();
    setOpenMenuId(null);
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectedReason || rejectedReason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }

    const requestId = selectedRequest.id;
    try {
      setSubmitting(true);
      setProcessingId(requestId);
      await leaveRequestService.rejectLeaveRequest(
        requestId,
        rejectedReason,
        selectedRequest?.version,
      );
      toast.success('Leave request rejected');
      setLeaveRequests(prev => prev.filter(r => r.id !== requestId));
      setShowRejectModal(false);
      setRejectedReason('');
      setSelectedRequest(null);
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing data...');
        setShowRejectModal(false);
        setRejectedReason('');
        fetchLeaveRequests();
      } else {
        toast.error(error.response?.data?.message || 'Failed to reject leave request');
      }
    } finally {
      setSubmitting(false);
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        icon: Clock,
        label: 'Pending'
      },
      approved: {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: CheckCircle,
        label: 'Approved'
      },
      rejected: {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        icon: XCircle,
        label: 'Rejected'
      },
      cancelled: {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        icon: XCircle,
        label: 'Cancelled'
      },
      canceled: {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        icon: XCircle,
        label: 'Cancelled'
      },
      done: {
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        icon: CheckCircle,
        label: 'Completed'
      },
    };

    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${config.bgColor} ${config.textColor}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const toggleMenu = (id, event) => {
    event.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) setOpenMenuId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-600">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Leave Requests</h1>
            <p className="text-sm text-gray-600">
              {view === 'my-requests' 
                ? 'Manage and track your time off requests' 
                : 'Review and approve leave requests'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Dropdown */}
            <div className="relative">
              <label className="block text-xs text-gray-600 mb-1">View:</label>
              <select
                value={view}
                onChange={(e) => setView(e.target.value)}
                className="px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium text-gray-700"
              >
                <option value="my-requests">My Leave Requests</option>
                <option value="management">Management View</option>
              </select>
            </div>

            {/* Create Button - Only show in my-requests view */}
            {view === 'my-requests' && (
              <div className="mt-5">
                <button
                  onClick={() => navigate('/leave-requests/create')}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  New Request
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Filter */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Search by Name/Reason
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Start Date From
            </label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              End Date To
            </label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-50 rounded-full mb-4">
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {view === 'my-requests' ? 'No leave requests yet' : 'No pending approvals'}
            </h3>
            <p className="text-sm text-gray-600 mb-4 max-w-sm mx-auto">
              {view === 'my-requests' 
                ? "Get started by creating your first leave request. It's quick and easy!"
                : 'All leave requests have been processed.'}
            </p>
            {view === 'my-requests' && (
              <button
                onClick={() => navigate('/leave-requests/create')}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Leave Request
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {view === 'management' && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Requester
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Reason
                  </th>
                  {view === 'my-requests' && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Approver
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaveRequests.map((request) => (
                  <tr 
                    key={request.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/leave-requests/${request.id}?view=${view}`)}
                  >
                    {/* Requester Column - Management View Only */}
                    {view === 'management' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {request.user?.username?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {request.user?.username || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {request.user?.email || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Period Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(request.startDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                            {' → '}
                            {new Date(request.endDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            Submitted: {new Date(request.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Days Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {calculateDays(request.startDate, request.endDate)} days
                      </span>
                    </td>

                    {/* Reason Column */}
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm text-gray-900 truncate">
                        {request.reason || <span className="text-gray-400 italic">No reason provided</span>}
                      </div>
                      {request.status === 'rejected' && request.rejectedReason && (
                        <div className="mt-1 text-xs text-red-600">
                          <strong>Rejected:</strong> {request.rejectedReason}
                        </div>
                      )}
                    </td>

                    {/* Approver Column - My Requests View Only */}
                    {view === 'my-requests' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {request.approver?.username?.charAt(0).toUpperCase() || 'N'}
                          </div>
                          <span className="text-sm text-gray-900">{request.approver?.username || 'N/A'}</span>
                        </div>
                      </td>
                    )}

                    {/* Status Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm relative">
                      {view === 'my-requests' && request.status === 'pending' && (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleEdit(request, e)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 font-medium transition-colors"
                            title="Edit leave request"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleCancel(request.id, e)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 font-medium transition-colors"
                            title="Cancel leave request"
                          >
                            <XCircle className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      )}
                      
                      {view === 'management' && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => toggleMenu(request.id, e)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Actions"
                            disabled={!!processingId}
                          >
                            <MoreVertical className="w-5 h-5 text-gray-600" />
                          </button>
                          
                          {openMenuId === request.id && (
                            <div className="fixed mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50" style={{ marginLeft: '-180px' }}>
                              <div className="py-1">
                                <button
                                  onClick={(e) => handleApprove(request, e)}
                                  disabled={!!processingId}
                                  className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={(e) => handleReject(request, e)}
                                  disabled={!!processingId}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {view === 'my-requests' && request.status !== 'pending' && (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setRejectedReason('');
            setSelectedRequest(null);
          }}
          title="Reject Leave Request"
        >
          <div className="space-y-4">
            {/* Request Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Employee:</strong> {selectedRequest.user?.username || 'Unknown'}
              </p>
              <p className="text-sm text-yellow-800">
                <strong>Period:</strong> {new Date(selectedRequest.startDate).toLocaleDateString()} - {new Date(selectedRequest.endDate).toLocaleDateString()}
              </p>
            </div>

            {/* Rejection Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection *
              </label>
              <textarea
                value={rejectedReason}
                onChange={(e) => setRejectedReason(e.target.value)}
                placeholder="Please provide a detailed reason for rejecting this leave request (minimum 10 characters)..."
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {rejectedReason.length} / 10 characters minimum
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectedReason('');
                  setSelectedRequest(null);
                }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
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
