import api from './api';

export const authService = {
  // Login with email (for testing)
  loginWithEmail: async (email) => {
    const response = await api.post('/auth/login/email', { email });
    return response.data.data || response.data;
  },

  // Get current user profile
  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data.data || response.data;
  },

  // Refresh token
  refreshToken: async (refreshToken) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data.data || response.data;
  },

  // Logout
  logout: async () => {
    const response = await api.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return response.data;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('accessToken');
  },

  // Save tokens
  saveTokens: (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  // Get Zoho login URL
  getZohoLoginUrl: () => {
    return '/api/v1/auth/zoho';
  },
};

export default authService;
