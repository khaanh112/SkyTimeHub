import api from './api';

const otService = {
  // List OT plans with server-side pagination & filters
  getOtPlansList: async (params = {}) => {
    const query = {};
    if (params.view) query.view = params.view;
    if (params.page) query.page = params.page;
    if (params.pageSize) query.pageSize = params.pageSize;
    if (params.status) query.status = params.status;
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.q) query.q = params.q;
    if (params.sort) query.sort = params.sort;
    if (params.departmentId) query.departmentId = params.departmentId;
    const response = await api.get('/ot-plans', { params: query });
    return response.data;
  },

  // Get OT plan by ID
  getOtPlan: async (id) => {
    const response = await api.get(`/ot-plans/${id}`);
    return response.data.data || response.data;
  },

  // Create a new OT plan
  createOtPlan: async (data) => {
    const response = await api.post('/ot-plans', data);
    return response.data.data || response.data;
  },

  // Update an existing OT plan
  updateOtPlan: async (id, data) => {
    const response = await api.put(`/ot-plans/${id}`, data);
    return response.data.data || response.data;
  },

  // Approve OT plan
  approveOtPlan: async (id, version) => {
    const response = await api.patch(`/ot-plans/${id}/approve`, { version });
    return response.data.data || response.data;
  },

  // Reject OT plan
  rejectOtPlan: async (id, rejectedReason, version) => {
    const response = await api.patch(`/ot-plans/${id}/reject`, { rejectedReason, version });
    return response.data.data || response.data;
  },

  // Cancel OT plan
  cancelOtPlan: async (id) => {
    const response = await api.patch(`/ot-plans/${id}/cancel`);
    return response.data.data || response.data;
  },

  // Employee check-in
  checkin: async (otPlanEmployeeId) => {
    const response = await api.post('/ot-plans/checkin', { otPlanEmployeeId });
    return response.data.data || response.data;
  },

  // Employee check-out
  checkout: async (checkinId, workOutput, compensatoryMethod, version) => {
    const response = await api.patch('/ot-plans/checkout', {
      checkinId,
      workOutput,
      compensatoryMethod,
      version,
    });
    return response.data.data || response.data;
  },

  // Leader approve check-in (with optional time overrides)
  approveCheckin: async (checkinId, version, overrides = {}) => {
    const response = await api.patch('/ot-plans/checkin/approve', {
      checkinId,
      version,
      ...(overrides.checkInAt ? { checkInAt: overrides.checkInAt } : {}),
      ...(overrides.checkOutAt ? { checkOutAt: overrides.checkOutAt } : {}),
      ...(overrides.compensatoryMethod ? { compensatoryMethod: overrides.compensatoryMethod } : {}),
    });
    return response.data.data || response.data;
  },

  // Leader reject check-in
  rejectCheckin: async (checkinId, rejectedReason, version) => {
    const response = await api.patch('/ot-plans/checkin/reject', { checkinId, rejectedReason, version });
    return response.data.data || response.data;
  },

  // Get employee OT summary (for tooltip)
  getEmployeeOtSummary: async (employeeId) => {
    const response = await api.get(`/ot-plans/employee-ot-summary/${employeeId}`);
    return response.data.data || response.data;
  },

  // List assigned OT items for the current employee (personal view)
  getMyAssignments: async (params = {}) => {
    const query = {};
    if (params.page) query.page = params.page;
    if (params.pageSize) query.pageSize = params.pageSize;
    if (params.otBenefits) query.otBenefits = params.otBenefits;
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.status) query.status = params.status;
    const response = await api.get('/ot-plans/my-assignments', { params: query });
    return response.data;
  },

  // Get a single assigned OT item detail
  getMyAssignment: async (id) => {
    const response = await api.get(`/ot-plans/my-assignments/${id}`);
    return response.data.data || response.data;
  },

  // Get OT plan employee assignment detail (admin/leader view, no user restriction)
  getOtPlanEmployee: async (id) => {
    const response = await api.get(`/ot-plans/employees/${id}`);
    return response.data.data || response.data;
  },

  // Export report as CSV download
  exportReport: async (params = {}) => {
    const query = {};
    if (params.status) query.status = params.status;
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.q) query.q = params.q;
    const response = await api.get('/ot-plans/export', {
      params: query,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ot-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default otService;
