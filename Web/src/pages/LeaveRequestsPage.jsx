import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { LoadingSpinner } from '../components';
import { toast } from 'react-toastify';
import { Calendar, Clock, FileText, CheckCircle, XCircle, Edit, Plus } from 'lucide-react';

const LeaveRequestsPage = () => {
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const data = await leaveRequestService.getMyLeaveRequests();
      setLeaveRequests(data.data || data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      await leaveRequestService.cancelLeaveRequest(id);
      toast.success('Leave request cancelled successfully');
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error cancelling leave request:', error);
      const data = error.response?.data;
      if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
        data.details.forEach((msg) => toast.error(msg));
      } else {
        toast.error(data?.message || 'Failed to cancel leave request');
      }
    }
  };

  const handleEdit = (request) => {
    navigate(`/leave-requests/${request.id}/edit`);
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
      done: {
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        icon: CheckCircle,
        label: 'Completed'
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-gray-600">Loading your leave requests...</p>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">My Leave Requests</h1>
            <p className="text-sm text-gray-600">Manage and track your time off requests</p>
          </div>
          <button
            onClick={() => navigate('/leave-requests/create')}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Leave Request
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-xs font-medium mb-1">Total Requests</div>
              <div className="text-2xl font-bold text-gray-900">{leaveRequests.length}</div>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-xs font-medium mb-1">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">
                {leaveRequests.filter(r => r.status === 'pending').length}
              </div>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-xs font-medium mb-1">Approved</div>
              <div className="text-2xl font-bold text-green-600">
                {leaveRequests.filter(r => r.status === 'approved').length}
              </div>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-600 text-xs font-medium mb-1">Rejected</div>
              <div className="text-2xl font-bold text-red-600">
                {leaveRequests.filter(r => r.status === 'rejected').length}
              </div>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        {leaveRequests.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-50 rounded-full mb-4">
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No leave requests yet</h3>
            <p className="text-sm text-gray-600 mb-4 max-w-sm mx-auto">
              Get started by creating your first leave request. It's quick and easy!
            </p>
            <button
              onClick={() => navigate('/leave-requests/create')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Leave Request
            </button>
          </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Days
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Approver
                    </th>
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
                      onClick={() => navigate(`/leave-requests/${request.id}`)}
                    >
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {calculateDays(request.startDate, request.endDate)} days
                        </span>
                      </td>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {request.approver?.username?.charAt(0).toUpperCase() || 'N'}
                          </div>
                          <span className="text-sm text-gray-900">{request.approver?.username || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {request.status === 'pending' && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEdit(request)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 font-medium transition-colors"
                              title="Edit leave request"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleCancel(request.id)}
                              className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 font-medium transition-colors"
                              title="Cancel leave request"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        )}
                        {request.status !== 'pending' && (
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
    </div>
  );
};

export default LeaveRequestsPage;
