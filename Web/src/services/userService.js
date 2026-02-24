import api from './api';

export const userService = {
  // Get all users
  getAll: async () => {
    const response = await api.get('/users');
    return response.data.data || response.data;
  },

  // Get user by ID
  getById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data.data || response.data;
  },

  // Get current user profile
  getCurrentProfile: async () => {
    const response = await api.get('/users/me/profile');
    return response.data.data || response.data;
  },

  // Get current user approver ID
  getCurrentApprover: async () => {
    const response = await api.get('/users/me/approver');
    return response.data.data || response.data;
  },

  // Get user approver by user ID
  getApprover: async (userId) => {
    const response = await api.get(`/users/${userId}/approver`);
    return response.data.data || response.data;
  },

  // Create new user
  create: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data.data || response.data;
  },

  // Update user
  update: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data.data || response.data;
  },

  // Delete user
  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data.data || response.data;
  },

  // Import users - Preview
  previewImport: async (file, signal) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
    
    if (signal) {
      config.signal = signal;
    }
    
    const response = await api.post('/users/import/preview', formData, config);
    return response.data.data || response.data;
  },

  // Import users - Execute
  executeImport: async (rows, signal) => {
    const config = {};
    if (signal) {
      config.signal = signal;
    }
    
    const response = await api.post('/users/import/execute', { rows }, config);
    return response.data.data || response.data;
  },

  // Deactivate user account
  deactivate: async (id) => {
    const response = await api.post(`/users/${id}/deactivate`);
    return response.data.data || response.data;
  },

  // Reactivate user account (from inactive to active)
  reactivate: async (id) => {
    const response = await api.post(`/users/${id}/activate`);
    return response.data.data || response.data;
  },

  // Create user profile (atomic: user + approver + department leader)
  createProfile: async (profileData) => {
    const response = await api.post('/user-profile', profileData);
    return response.data.data || response.data;
  },

  // Update user profile (atomic: user + approver + department leader)
  updateProfile: async (id, profileData) => {
    const response = await api.put(`/user-profile/${id}`, profileData);
    return response.data.data || response.data;
  },
};

export default userService;
