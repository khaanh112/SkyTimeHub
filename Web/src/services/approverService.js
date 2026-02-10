import api from './api';

export const approverService = {
  // Get approvers for a user
  getApproversForUser: async (userId) => {
    const response = await api.get(`/settings/approver-config/${userId}/approvers`);
    return response.data.data || response.data;
  },

  // Set approver for a user (HR/Admin only)
  setApproverForUser: async (userId, approverId, createdBy) => {
    const response = await api.put(`/settings/approver-config/${userId}/approver`, {
      approverId,
      createdBy,
    });
    return response.data.data || response.data;
  },
};

export default approverService;
