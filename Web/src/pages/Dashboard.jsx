import { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Activity, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../components';
import { userService } from '../services';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const StatCard = ({ icon: Icon, label, value, color, bgColor }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
      <div className={`w-12 h-12 ${bgColor} rounded-xl flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const users = await userService.getAll();
      
      const activeCount = users.filter(u => u.status === 'active').length;
      const inactiveCount = users.filter(u => u.status === 'inactive').length;
      
      setStats({
        totalUsers: users.length,
        activeUsers: activeCount,
        inactiveUsers: inactiveCount,
      });
      
      // Get 5 most recent users
      setRecentUsers(users.slice(-5).reverse());
      
      toast.success('Dữ liệu đã được cập nhật!');
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-700',
      hr: 'bg-blue-100 text-blue-700',
      employee: 'bg-gray-100 text-gray-700',
    };
    return styles[role] || styles.employee;
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
      suspended: 'bg-red-100 text-red-700',
    };
    return styles[status] || styles.inactive;
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Welcome Section */}
      <div className="bg-linear-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">
          Xin chào, {user?.username || 'Guest'}! 👋
        </h1>
        <p className="text-blue-100 mt-1">
          Chào mừng bạn đến với SkyTimeHub API Testing Dashboard
        </p>
      </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            icon={Users}
            label="Tổng số Users"
            value={loading ? '-' : stats.totalUsers}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <StatCard
            icon={UserCheck}
            label="Users Active"
            value={loading ? '-' : stats.activeUsers}
            color="text-green-600"
            bgColor="bg-green-100"
          />
          <StatCard
            icon={UserX}
            label="Users Inactive"
            value={loading ? '-' : stats.inactiveUsers}
            color="text-gray-600"
            bgColor="bg-gray-100"
          />
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Users gần đây
              </h2>
            </div>
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : recentUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Chưa có user nào
              </div>
            ) : (
              <div className="space-y-4">
                {recentUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-linear-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {u.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.username}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRoleBadge(u.role)}`}>
                        {u.role}
                      </span>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(u.status)}`}>
                        {u.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            API Endpoints
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-medium text-gray-700">Auth Endpoints</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>• GET /api/v1/auth/zoho - Zoho OAuth</li>
                <li>• GET /api/v1/auth/me - Get profile</li>
                <li>• POST /api/v1/auth/refresh - Refresh token</li>
                <li>• POST /api/v1/auth/logout - Logout</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-medium text-gray-700">User Endpoints</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>• GET /api/v1/users - Get all users</li>
                <li>• GET /api/v1/users/:id - Get user by ID</li>
                <li>• POST /api/v1/users - Create user</li>
                <li>• PUT /api/v1/users/:id - Update user</li>
                <li>• DELETE /api/v1/users/:id - Delete user</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Dashboard;
