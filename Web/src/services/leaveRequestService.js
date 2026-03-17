import api from './api';

const leaveRequestService = {
  // List leave requests with server-side pagination & filters
  // params: { view, page, pageSize, status, leaveType, from, to, q, sort }
  // view: 'personal' | 'management'
  // status: comma-separated string e.g. 'pending,approved'
  // leaveType: comma-separated leave type IDs e.g. '1,3'
  getLeaveRequestsList: async (params = {}) => {
    const query = {};
    if (params.view)      query.view      = params.view;
    if (params.page)      query.page      = params.page;
    if (params.pageSize)  query.pageSize  = params.pageSize;
    if (params.status)    query.status    = params.status;
    if (params.leaveType) query.leaveType = params.leaveType;
    if (params.from)      query.from      = params.from;
    if (params.to)        query.to        = params.to;
    if (params.q)         query.q         = params.q;
    if (params.sort)      query.sort      = params.sort;
    const response = await api.get('/leave-requests', { params: query });
    return response.data; // { success, data, page: { page, pageSize, total } }
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
    const response = await api.patch(`/leave-requests/${id}/approve`, { version });
    return response.data;
  },

  // Reject a leave request (with optimistic locking version)
  rejectLeaveRequest: async (id, rejectedReason, version) => {
    const response = await api.patch(`/leave-requests/${id}/reject`, { rejectedReason, version });
    return response.data;
  },

  // Cancel a leave request
  cancelLeaveRequest: async (id) => {
    const response = await api.patch(`/leave-requests/${id}/cancel`);
    return response.data;
  },

  // Get leave balance summary for current user
  getBalanceSummary: async (year, month) => {
    const params = {};
    if (year !== undefined) params.year = year;
    if (month !== undefined) params.month = month;
    const response = await api.get('/leave-requests/balance-summary', { params });
    return response.data;
  },

  // Get leave balance summary for a specific user (management view)
  getUserBalanceSummary: async (userId, year, month) => {
    const params = {};
    if (year !== undefined) params.year = year;
    if (month !== undefined) params.month = month;
    const response = await api.get(`/leave-requests/employee-balance-summary/${userId}`, { params });
    return response.data;
  },

  // Upload a PDF attachment for Social leave (returns { attachmentId, originalFilename, sizeBytes })
  uploadAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/leave-requests/attachments/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Get a presigned URL for viewing/downloading an attachment
  getAttachmentUrl: async (attachmentId) => {
    const response = await api.get(`/leave-requests/attachments/${attachmentId}/url`);
    return response.data; // { url, originalFilename }
  },

  // ── Leave Report ──────────────────────────────────────────────────────────

  // Get all departments for report filter
  getReportDepartments: async () => {
    const response = await api.get('/leave-requests/report/departments');
    return response.data; // [{ id, name }]
  },

  // Get leave days report data
  // params: { year?, month?, departmentId? }
  getLeaveReport: async (params = {}) => {
    const query = {};
    if (params.year)         query.year         = params.year;
    if (params.month)        query.month        = params.month;
    if (params.departmentId) query.departmentId = params.departmentId;
    const response = await api.get('/leave-requests/report', { params: query });
    return response.data; // { rows: [...], hasPending: boolean }
  },

  // Export leave days report as Excel – triggers file download
  // params: { year?, month?, departmentId? }
  exportLeaveReport: async (params = {}) => {
    const query = {};
    if (params.year)         query.year         = params.year;
    if (params.month)        query.month        = params.month;
    if (params.departmentId) query.departmentId = params.departmentId;
    const response = await api.get('/leave-requests/report/export', {
      params: query,
      responseType: 'blob',
    });
    // Trigger browser download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const month = params.month ? String(params.month).padStart(2, '0') + '-' : '';
    link.setAttribute('download', `leave-report-${month}${params.year ?? new Date().getFullYear()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default leaveRequestService;
