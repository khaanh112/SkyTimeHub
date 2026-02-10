import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { Modal, LoadingSpinner, UserMultiSelect } from '../components';
import { toast } from 'react-toastify';
import { ArrowLeft, Calendar, Clock, Users, FileText, CheckCircle, XCircle, AlertCircle, Edit } from 'lucide-react';

const LeaveRequestsPage = () => {
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    ccUserIds: [],
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      setSubmitting(true);
      await leaveRequestService.createLeaveRequest(formData);
      toast.success('Leave request submitted successfully! 🎉');
      setShowModal(false);
      setFormData({ startDate: '', endDate: '', reason: '', ccUserIds: [] });
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error creating leave request:', error);
      toast.error(error.response?.data?.message || 'Failed to create leave request');
    } finally {
      setSubmitting(false);
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
      toast.error(error.response?.data?.message || 'Failed to cancel leave request');
    }
  };

  const handleEdit = (request) => {
    setEditingRequest(request);
    setFormData({
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason || '',
      ccUserIds: request.ccUserIds || [],
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      setSubmitting(true);
      const result = await leaveRequestService.updateLeaveRequest(editingRequest.id, {
        ...formData,
      
      });
      toast.success('Leave request updated successfully! 🎉');
      setShowEditModal(false);
      setEditingRequest(null);
      setFormData({ startDate: '', endDate: '', reason: '', ccUserIds: [] });
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error updating leave request:', error);
      console.error('Error response data:', error.response?.data);
      const errorData = error.response?.data;
      let errorMessage = errorData?.message || 'Failed to update leave request';
      
      // Show validation details if available
      if (errorData?.details && Array.isArray(errorData.details)) {
        errorMessage = errorData.details.join(', ');
      }
      
      // Special handling for version conflict
      if (error.response?.status === 409) {
        toast.error('This request has been modified. Please refresh and try again.', {
          autoClose: 5000,
        });
        setShowEditModal(false);
        setEditingRequest(null);
        fetchLeaveRequests(); // Refresh data
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
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
      <div className="flex justify-center items-center h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading your leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200 mb-4 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">My Leave Requests</h1>
              <p className="text-gray-600">Manage and track your time off requests</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
            >
              <Calendar className="w-5 h-5" />
              New Leave Request
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">Total Requests</div>
                <div className="text-3xl font-bold text-gray-900">{leaveRequests.length}</div>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">Pending</div>
                <div className="text-3xl font-bold text-yellow-600">
                  {leaveRequests.filter(r => r.status === 'pending').length}
                </div>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">Approved</div>
                <div className="text-3xl font-bold text-green-600">
                  {leaveRequests.filter(r => r.status === 'approved').length}
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm font-medium mb-1">Rejected</div>
                <div className="text-3xl font-bold text-red-600">
                  {leaveRequests.filter(r => r.status === 'rejected').length}
                </div>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Leave Requests Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {leaveRequests.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No leave requests yet</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                Get started by creating your first leave request. It's quick and easy!
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Calendar className="w-5 h-5" />
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
                    <tr key={request.id} className="hover:bg-gray-50 transition-colors">
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
                          <div className="flex items-center gap-2">
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

      {/* Create Leave Request Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setFormData({ startDate: '', endDate: '', reason: '', ccUserIds: [] });
        }}
        title="📝 New Leave Request"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          {formData.startDate && formData.endDate && (
            <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Duration: {calculateDays(formData.startDate, formData.endDate)} days
                  </p>
                  <p className="text-xs text-blue-700">
                    {new Date(formData.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(formData.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason
              <span className="ml-1 text-xs text-gray-500 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows="3"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="e.g., Family vacation, Medical appointment, Personal matters..."
              />
            </div>
          </div>

          <div>
            <UserMultiSelect
              selectedUserIds={formData.ccUserIds}
              onChange={(userIds) => setFormData({ ...formData, ccUserIds: userIds })}
              excludeCurrentUser={true}
            />
            <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Selected users will receive email notifications about this leave request
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setFormData({ startDate: '', endDate: '', reason: '', ccUserIds: [] });
              }}
              disabled={submitting}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="spinner w-4 h-4 border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Leave Request Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRequest(null);
          setFormData({ startDate: '', endDate: '', reason: '', ccUserIds: [] });
        }}
        title="✏️ Edit Leave Request"
        size="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Version info alert */}
          {editingRequest && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Note:</strong> Only pending requests can be edited. Changes will reset the approval process.
                  
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          {formData.startDate && formData.endDate && (
            <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Duration: {calculateDays(formData.startDate, formData.endDate)} days
                  </p>
                  <p className="text-xs text-blue-700">
                    {new Date(formData.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(formData.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason
              <span className="ml-1 text-xs text-gray-500 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows="3"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="e.g., Family vacation, Medical appointment, Personal matters..."
              />
            </div>
          </div>

          <div>
            <UserMultiSelect
              selectedUserIds={formData.ccUserIds}
              onChange={(userIds) => setFormData({ ...formData, ccUserIds: userIds })}
              excludeCurrentUser={true}
            />
            <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Selected users will receive email notifications about this leave request
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingRequest(null);
                setFormData({ startDate: '', endDate: '', reason: '', ccUserIds: [] });
              }}
              disabled={submitting}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="spinner w-4 h-4 border-2 border-white border-t-transparent" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Update Request
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeaveRequestsPage;
