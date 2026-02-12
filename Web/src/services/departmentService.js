import api from './api';

const departmentService = {
  /**
   * Get all departments
   */
  getAll: async () => {
    try {
      const response = await api.get('/department');
      // Backend wraps response in { success, data }
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }
  },

  /**
   * Get department by ID
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/department/${id}`);
      // Backend wraps response in { success, data }
      return response.data.data || response.data;
    } catch (error) {
      console.error(`Error fetching department ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create new department
   */
  create: async (departmentData) => {
    try {
      const response = await api.post('/department', departmentData);
      return response.data;
    } catch (error) {
      console.error('Error creating department:', error);
      throw error;
    }
  },

  /**
   * Update department
   */
  update: async (id, departmentData) => {
    try {
      const response = await api.put(`/department/${id}`, departmentData);
      return response.data.data || response.data;
    } catch (error) {
      console.error(`Error updating department ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete department
   */
  delete: async (id) => {
    try {
      const response = await api.delete(`/department/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting department ${id}:`, error);
      throw error;
    }
  },
};

export default departmentService;
