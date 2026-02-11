import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leaveRequestService } from '../services';
import { UserMultiSelect, LoadingSpinner } from '../components';
import { toast } from 'react-toastify';
import { ArrowLeft, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

const EditLeaveRequestPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    workSolution: '',
    ccUserIds: [],
  });

  useEffect(() => {
    fetchLeaveRequest();
  }, [id]);

  const fetchLeaveRequest = async () => {
    try {
      setLoading(true);
      const response = await leaveRequestService.getLeaveRequest(id);
      const data = response.data || response;
      setRequest(data);
      setFormData({
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || '',
        workSolution: data.workSolution || '',
        ccUserIds: data.ccUserIds || [],
      });
    } catch (error) {
      console.error('Error fetching leave request:', error);
      toast.error('Failed to load leave request');
      navigate('/leave-requests');
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
      const result = await leaveRequestService.updateLeaveRequest(id, formData);
      toast.success('Leave request updated successfully! 🎉');
      navigate('/leave-requests');
    } catch (error) {
      console.error('Error updating leave request:', error);
      toast.error(error.response?.data?.message || 'Failed to update leave request');
    } finally {
      setSubmitting(false);
    }
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
      <div className="flex items-center justify-center min-h-100">
        <LoadingSpinner />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  // Only allow editing pending requests
  if (request.status !== 'pending') {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Cannot Edit Request</h3>
              <p className="text-sm text-yellow-800 mb-4">
                Only pending leave requests can be edited. This request has status: <strong>{request.status}</strong>
              </p>
              <button
                onClick={() => navigate('/leave-requests')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to My Requests
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/leave-requests')}
          className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to My Requests</span>
        </button>
        
        <h1 className="text-2xl font-bold text-gray-900">Edit Leave Request</h1>
        <p className="text-sm text-gray-600 mt-1">Update the details for your leave request</p>
      </div>

      {/* Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Note:</strong> Changes to this request will reset the approval process. Your approver will be notified of the changes.
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Time Selection */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">1</div>
              <h3 className="text-base font-semibold text-gray-900">Time Selection</h3>
            </div>
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
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Duration</label>
                <div className="bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
                  <span className="text-gray-900 font-medium">{calculateDays(formData.startDate, formData.endDate)} Days</span>
                </div>
              </div>
            )}
          </div>

          {/* Justification */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">2</div>
              <h3 className="text-base font-semibold text-gray-900">Justification</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows="6"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Please provide the reason for your leave request..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Solution / Handover
                </label>
                <textarea
                  value={formData.workSolution}
                  onChange={(e) => setFormData({ ...formData, workSolution: e.target.value })}
                  rows="6"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Describe how your work will be handled during your absence..."
                />
              </div>
            </div>
          </div>

          {/* Additional */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-semibold">3</div>
              <h3 className="text-base font-semibold text-gray-900">Additional Recipients</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CC Users</label>
              <UserMultiSelect
                selectedUserIds={formData.ccUserIds}
                onChange={(userIds) => setFormData({ ...formData, ccUserIds: userIds })}
                excludeCurrentUser={true}
              />
              <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Your approver and all HR users will automatically receive email notifications
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/leave-requests')}
              disabled={submitting}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
      </div>
    </div>
  );
};

export default EditLeaveRequestPage;
