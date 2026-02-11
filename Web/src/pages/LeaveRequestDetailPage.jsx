import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { LoadingSpinner, StatusBadge, DetailSection } from '../components';
import { toast } from 'react-toastify';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  XCircle, 
  AlertCircle,
  Users,
  Edit,
  Info
} from 'lucide-react';

const LeaveRequestDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [leaveRequest, setLeaveRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaveRequestDetail();
  }, [id]);

  const fetchLeaveRequestDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await leaveRequestService.getLeaveRequest(id);
      setLeaveRequest(response.data || response);
    } catch (error) {
      console.error('Error fetching leave request detail:', error);
      setError(error.response?.data?.message || 'Failed to load leave request details');
      toast.error('Failed to load leave request details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      await leaveRequestService.cancelLeaveRequest(leaveRequest.id);
      toast.success('Leave request cancelled successfully');
      navigate('/leave-requests');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel leave request');
    }
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-600">Loading leave request details...</p>
        </div>
      </div>
    );
  }

  if (error || !leaveRequest) {
    return (
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/leave-requests')}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to My Requests</span>
        </button>
        
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Leave Request Not Found</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'The leave request you are looking for does not exist or you do not have permission to view it.'}</p>
          <button
            onClick={() => navigate('/leave-requests')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Requests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/leave-requests')}
            className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to My Requests</span>
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Request Details</h1>
              <p className="text-sm text-gray-600 mt-1">Request ID: #{leaveRequest.id}</p>
            </div>
            <StatusBadge status={leaveRequest.status} size="lg" />
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-6 space-y-5">
            {/* Leave Period */}
            <DetailSection title="Leave Period" icon={Calendar}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Start Date</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(leaveRequest.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">End Date</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(leaveRequest.endDate)}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Duration</span>
                <span className="inline-flex items-center gap-2 text-blue-700 font-semibold">
                  <Clock className="w-4 h-4" />
                  {calculateDays(leaveRequest.startDate, leaveRequest.endDate)} days
                </span>
              </div>
            </DetailSection>

            {/* Reason & Work Solution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailSection title="Reason" icon={FileText}>
                <p className="text-sm text-gray-900">
                  {leaveRequest.reason || <span className="text-gray-400 italic">No reason provided</span>}
                </p>
              </DetailSection>

              {leaveRequest.workSolution && (
                <DetailSection title="Work Solution / Handover" icon={FileText}>
                  <p className="text-sm text-gray-900">{leaveRequest.workSolution}</p>
                </DetailSection>
              )}
            </div>

            {/* Rejection Reason */}
            {leaveRequest.status === 'rejected' && leaveRequest.rejectedReason && (
              <DetailSection title="Rejection Reason" icon={XCircle} variant="warning">
                <p className="text-sm text-red-900 font-medium">{leaveRequest.rejectedReason}</p>
              </DetailSection>
            )}

            {/* Approver & CC Recipients */}
            <div className={`grid grid-cols-1 ${leaveRequest.ccRecipients && leaveRequest.ccRecipients.length > 0 ? 'md:grid-cols-2' : ''} gap-6`}>
              <DetailSection title="Approver" icon={User}>
                {leaveRequest.approver ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {leaveRequest.approver.username?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{leaveRequest.approver.username}</p>
                      <p className="text-xs text-gray-600">{leaveRequest.approver.email}</p>
                      {leaveRequest.approver.department && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {leaveRequest.approver.department}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No approver assigned</p>
                )}
              </DetailSection>

              {/* CC Recipients */}
              {leaveRequest.ccRecipients && leaveRequest.ccRecipients.length > 0 && (
                <DetailSection title={`CC Recipients (${leaveRequest.ccRecipients.length})`} icon={Users}>
                  <div className="flex flex-wrap gap-2">
                    {leaveRequest.ccRecipients.map((recipient, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200"
                      >
                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {recipient.username?.charAt(0).toUpperCase() || recipient.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-medium text-gray-900">{recipient.username || recipient.email}</p>
                          {recipient.username && recipient.email && (
                            <p className="text-xs text-gray-500">{recipient.email}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>

            {/* Request Information */}
            <DetailSection title="Request Information" icon={Info}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Submitted On</p>
                  <p className="text-xs font-medium text-gray-900">{formatDateTime(leaveRequest.createdAt)}</p>
                </div>
                {leaveRequest.updatedAt && leaveRequest.updatedAt !== leaveRequest.createdAt && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Last Updated</p>
                    <p className="text-xs font-medium text-gray-900">{formatDateTime(leaveRequest.updatedAt)}</p>
                  </div>
                )}
              </div>
            </DetailSection>
          </div>
        </div>

        {/* Actions */}
        {leaveRequest.status === 'pending' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/leave-requests/${leaveRequest.id}/edit`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Request
              </button>
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 rounded-lg text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel Request
              </button>
            </div>
          </div>
        )}
      </div>
  );
};

export default LeaveRequestDetailPage;
