import api from './api';

const leaveRequestService = {
  // Get all leave requests for current user
  getMyLeaveRequests: async () => {
    const response = await api.get('/leave-requests');
    return response.data;
  },

  // Get pending approvals for current user (as approver)
  getPendingApprovals: async () => {
    const response = await api.get('/leave-requests/pending-approvals');
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

  // Approve a leave request
  approveLeaveRequest: async (id) => {
    const response = await api.patch(`/leave-requests/${id}/approve`);
    return response.data;
  },

  // Reject a leave request
  rejectLeaveRequest: async (id) => {
    const response = await api.patch(`/leave-requests/${id}/reject`);
    return response.data;
  },

  // Cancel a leave request
  cancelLeaveRequest: async (id) => {
    const response = await api.patch(`/leave-requests/${id}/cancel`);
    return response.data;
  },
};

export default leaveRequestService;
