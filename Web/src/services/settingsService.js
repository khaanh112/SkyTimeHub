import api from './api';

const settingsService = {
  // ── OT Policy ──────────────────────────────────────────────

  getOtPolicy: async () => {
    const response = await api.get('/settings/ot-policy');
    return response.data.data || response.data;
  },

  saveOtPolicy: async (policy) => {
    const response = await api.put('/settings/ot-policy', policy);
    return response.data.data || response.data;
  },

  // ── Leave Policy ───────────────────────────────────────────

  getLeavePolicy: async () => {
    const response = await api.get('/settings/leave-policy');
    return response.data.data || response.data;
  },

  saveLeavePolicy: async (policy) => {
    const response = await api.put('/settings/leave-policy', policy);
    return response.data.data || response.data;
  },
};

export default settingsService;
