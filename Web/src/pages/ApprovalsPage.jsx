import { useState, useEffect } from 'react';
import { leaveRequestService } from '../services';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';

const ApprovalsPage = () => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectedReason, setRejectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const data = await leaveRequestService.getManagementRequests();
      setPendingApprovals(data.data || data);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (processingId) return;
    if (!window.confirm('Are you sure you want to APPROVE this leave request?')) {
      return;
    }

    const request = pendingApprovals.find(r => r.id === id) || selectedRequest;
    try {
      setProcessingId(id);
      await leaveRequestService.approveLeaveRequest(id, request?.version);
      toast.success('Leave request approved successfully!');
      // Optimistically remove from list so user can't click again
      setPendingApprovals(prev => prev.filter(r => r.id !== id));
      setShowDetailModal(false);
      setSelectedRequest(null);
      fetchPendingApprovals();
    } catch (error) {
      console.error('Error approving leave request:', error);
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing data...');
        // Refresh the list
        await fetchPendingApprovals();
        // If detail modal is open, refresh the selected request with updated version
        if (showDetailModal && selectedRequest?.id === id) {
          try {
            const updatedRequest = await leaveRequestService.getLeaveRequest(id);
            setSelectedRequest(updatedRequest.data || updatedRequest);
            toast.info('Request details updated. Please review changes before approving.');
          } catch (fetchError) {
            console.error('Error fetching updated request:', fetchError);
            setShowDetailModal(false);
            setSelectedRequest(null);
          }
        }
      } else {
        const data = error.response?.data;
        if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
          data.details.forEach((msg) => toast.error(msg));
        } else {
          toast.error(data?.message || 'Failed to approve leave request');
        }
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    if (processingId) return;
    setSelectedRequest(pendingApprovals.find(r => r.id === id) || selectedRequest);
    setShowDetailModal(false);
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
      // Optimistically remove from list
      setPendingApprovals(prev => prev.filter(r => r.id !== requestId));
      setShowRejectModal(false);
      setRejectedReason('');
      setSelectedRequest(null);
      fetchPendingApprovals();
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Refreshing data...');
        // Close reject modal but keep data to show in detail modal
        setShowRejectModal(false);
        setRejectedReason('');
        // Refresh the list
        await fetchPendingApprovals();
        // Fetch updated request and show in detail modal
        try {
          const updatedRequest = await leaveRequestService.getLeaveRequest(requestId);
          setSelectedRequest(updatedRequest.data || updatedRequest);
          setShowDetailModal(true);
          toast.info('Request details updated. Please review changes before rejecting.');
        } catch (fetchError) {
          console.error('Error fetching updated request:', fetchError);
          setSelectedRequest(null);
        }
      } else {
        const data = error.response?.data;
        if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
          data.details.forEach((msg) => toast.error(msg));
        } else {
          toast.error(data?.message || 'Failed to reject leave request');
        }
      }
    } finally {
      setSubmitting(false);
      setProcessingId(null);
    }
  };

  const viewDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-sm text-gray-600 mt-1">Leave requests waiting for your approval</p>
      </div>

      {/* Stats Card */}
      <div className="bg-blue-600 rounded-lg shadow-sm p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">Total Pending Approvals</div>
            <div className="text-3xl font-bold mt-2">{pendingApprovals.length}</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Approvals List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {pendingApprovals.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending approvals</h3>
            <p className="mt-1 text-sm text-gray-500">All leave requests have been processed.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingApprovals.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {request.user?.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{request.user?.username || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{request.user?.email || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(request.startDate).toLocaleDateString()} -<br />
                      {new Date(request.endDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {calculateDays(request.startDate, request.endDate)} days
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {request.reason || <span className="text-gray-400 italic">No reason provided</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => viewDetails(request)}
                      className="text-blue-600 hover:text-blue-900 transition"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={!!processingId}
                      className="text-green-600 hover:text-green-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === request.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={!!processingId}
                      className="text-red-600 hover:text-red-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedRequest(null);
          }}
          title="Leave Request Details"
        >
          <div className="space-y-4">
            {/* Version Badge */}
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2">
              <span className="text-xs text-blue-800 font-medium">
                Version: {selectedRequest.version}
              </span>
              <span className="text-xs text-gray-600">
                Last updated: {new Date(selectedRequest.updatedAt || selectedRequest.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Employee Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Employee</h3>
              <div className="flex items-center">
                <div className="shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {selectedRequest.user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">{selectedRequest.user?.username}</div>
                  <div className="text-sm text-gray-500">{selectedRequest.user?.email}</div>
                  <div className="text-sm text-gray-500">Employee ID: {selectedRequest.user?.employeeId || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Leave Period */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Leave Period</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-600">Start Date</div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(selectedRequest.startDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">End Date</div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(selectedRequest.endDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <span className="text-sm font-semibold text-blue-800">
                    Total: {calculateDays(selectedRequest.startDate, selectedRequest.endDate)} days
                  </span>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Reason</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-900">
                  {selectedRequest.reason || <span className="text-gray-400 italic">No reason provided</span>}
                </p>
              </div>
            </div>

            {/* Rejected Reason (if rejected) */}
            {selectedRequest.status === 'rejected' && selectedRequest.rejectedReason && (
              <div>
                <h3 className="text-sm font-medium text-red-700 mb-2">Rejection Reason</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-900">
                    {selectedRequest.rejectedReason}
                  </p>
                </div>
              </div>
            )}

            {/* Submission Date */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Submitted On</h3>
              <div className="text-sm text-gray-900">
                {new Date(selectedRequest.createdAt).toLocaleString()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequest(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                onClick={() => handleReject(selectedRequest.id)}
                disabled={!!processingId}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedRequest.id)}
                disabled={!!processingId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processingId === selectedRequest.id && <LoadingSpinner size="sm" />}
                {processingId === selectedRequest.id ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </Modal>
      )}

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

            {/* Rejected Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection *
              </label>
              <textarea
                value={rejectedReason}
                onChange={(e) => setRejectedReason(e.target.value)}
                placeholder="Please provide a detailed reason for rejecting this leave request..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">Minimum 10 characters required</p>
                <p className={`text-xs ${rejectedReason.length > 450 ? 'text-amber-500' : rejectedReason.length < 10 ? 'text-red-400' : 'text-gray-400'}`}>
                  {rejectedReason.length}/500
                </p>
              </div>
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

export default ApprovalsPage;
