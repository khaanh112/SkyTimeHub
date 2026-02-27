import api from './api';

const leaveRequestService = {
  // Get all leave requests for current user
  getMyLeaveRequests: async () => {
    const response = await api.get('/leave-requests');
    return response.data;
  },

  // Get leave requests for management view (HR: all, Approver: assigned to them)
  getManagementRequests: async () => {
    const response = await api.get('/leave-requests/management');
    return response.data;
  },

  // Get pending approvals for current user (deprecated, use getManagementRequests)
  getPendingApprovals: async () => {
    const response = await api.get('/leave-requests/pending-approvals');
    return response.data;
  },

  // Get available leave types grouped by category
  getLeaveTypes: async () => {
    const response = await api.get('/leave-requests/leave-types');
    return response.data;
  },

  // Suggest end date for auto-calculate leave types (POLICY / SOCIAL)
  suggestEndDate: async (params) => {
    const response = await api.post('/leave-requests/suggest-end-date', params);
    return response.data;
  },

  // Get leave request by ID
  getLeaveRequest: async (id) => {
    const response = await api.get(`/leave-requests/${id}`);
    return response.data;
  },

  // Create a new leave request
  createLeaveRequest: async (data) => {
    const response = await api.post('/leave-requests', data);
    return response.data;
  },

  // Update an existing leave request
  updateLeaveRequest: async (id, data) => {
    const response = await api.put(`/leave-requests/${id}`, data);
    return response.data;
  },

  // Approve a leave request (with optimistic locking version)
  approveLeaveRequest: async (id, version) => {
    const response = await api.patch(`/leave-requests/${id}/approve`, {
      version,
    });
    return response.data;
  },

  // Reject a leave request (with optimistic locking version)
  rejectLeaveRequest: async (id, rejectedReason, version) => {
    const response = await api.patch(`/leave-requests/${id}/reject`, {
      rejectedReason,
      version,
    });
    return response.data;
  },

  // Cancel a leave request
  cancelLeaveRequest: async (id) => {
    const response = await api.patch(`/leave-requests/${id}/cancel`);
    return response.data;
  },
};

export default leaveRequestService;
