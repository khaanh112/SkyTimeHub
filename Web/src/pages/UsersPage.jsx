import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  User,
  Filter,
  Upload,
  UserCheck,
  UserX,
  Link as LinkIcon,
  Copy,
  Mail,
  UserCog,
  Eye,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { LoadingSpinner, Modal } from '../components';
import { userService, approverService, departmentService } from '../services';
import { useAuth } from '../context';

const ROLES = ['admin', 'hr', 'employee'];
const STATUSES = ['pending', 'active', 'inactive'];


const UsersPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedApproverId, setSelectedApproverId] = useState('');
 
  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    username: '',
    email: '',
    gender: 'male',
    role: 'employee',
    status: 'pending',
    departmentId: '',
    position: '',
    joinDate: '',
    officialContractDate: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await departmentService.getAll();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      setDepartments([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchSearch =
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = !filterRole || user.role === filterRole;
    const matchStatus = !filterStatus || user.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      username: '',
      email: '',
      gender: 'male',
      role: 'employee',
      status: 'pending',
      departmentId: '',
      position: '',
      joinDate: '',
      officialContractDate: '',
    });
  };


  const handleDelete = async () => {
    if (!selectedUser) return;
    setFormLoading(true);
    try {
      await userService.delete(selectedUser.id);
      toast.success('Xóa user thành công!');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setFormLoading(false);
    }
  };

  

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleGetActivationLink = async (user) => {
    try {
      const data = await userService.getActivationLink(user.id);
      // Copy to clipboard
      await navigator.clipboard.writeText(data.activationLink);
      toast.success('Activation link đã được copy vào clipboard!');
    } catch (error) {
      console.error('Failed to get activation link:', error);
      toast.error('Không thể lấy activation link');
    }
  };

  const handleResetActivationToken = async (user) => {
    if (!window.confirm(`Reset activation token cho user ${user.username}?`)) {
      return;
    }
    try {
      const data = await userService.resetActivationToken(user.id);
      await navigator.clipboard.writeText(data.activationLink);
      toast.success('Activation token đã được reset và link mới đã copy vào clipboard!');
      fetchUsers();
    } catch (error) {
      console.error('Failed to reset activation token:', error);
      toast.error('Không thể reset activation token');
    }
  };

  const handleResendActivationLink = async (user) => {
    if (!window.confirm(`Gửi lại activation link qua email cho user ${user.username} (${user.email})?`)) {
      return;
    }
    try {
      const data = await userService.resendActivationLink(user.id);
      toast.success(data.message || 'Activation link đã được gửi lại qua email!');
      fetchUsers();
    } catch (error) {
      console.error('Failed to resend activation link:', error);
      toast.error(error.response?.data?.message || 'Không thể gửi lại activation link');
    }
  };

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate user ${user.username}? User sẽ không thể đăng nhập.`)) {
      return;
    }
    try {
      await userService.deactivate(user.id);
      toast.success('Đã deactivate user thành công!');
      fetchUsers();
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      toast.error('Không thể deactivate user');
    }
  };

  

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
      pending: 'bg-yellow-100 text-yellow-700',
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
    };
    return styles[status] || styles.inactive;
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          
        </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/users/import')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors shadow-sm border border-gray-200"
            >
              <Upload className="w-5 h-5" />
              <span>Import Users</span>
            </button>
            <button
              onClick={() => navigate('/users/add')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-600/30"
            >
              <Plus className="w-5 h-5" />
              <span>Create User</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Roles</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>

            {/* Refresh */}
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Không tìm thấy user nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="text-sm font-mono text-gray-700">
                            {user.employeeId || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-linear-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-white font-medium">
                              {user.username?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.username}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getRoleBadge(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                            user.status
                          )}`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Action buttons based on status */}
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleGetActivationLink(user)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Get Activation Link"
                              >
                                <LinkIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResetActivationToken(user)}
                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title="Reset Activation Token"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResendActivationLink(user)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Resend Activation Link (Email)"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </>
                          )}
                       
                          
              
                          
                          {/* View button - always visible */}
                          <button
                            onClick={() => navigate(`/users/${user.id}`)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit button - always visible */}
                          <button
                            onClick={() => navigate(`/users/${user.id}/edit`)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          
                          
                          {/* Delete button - always visible */}
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      


        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedUser(null);
          }}
          title="Xác nhận xóa"
          size="sm"
        >
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-gray-700 mb-2">
              Bạn có chắc chắn muốn xóa user này?
            </p>
            <p className="text-sm text-gray-500">
              <strong>{selectedUser?.username}</strong> ({selectedUser?.email})
            </p>
          </div>
          <div className="flex justify-center space-x-3 pt-4">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedUser(null);
              }}
              className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleDelete}
              disabled={formLoading}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {formLoading && <LoadingSpinner size="sm" />}
              <span>Xóa</span>
            </button>
          </div>
        </Modal>

      </div>
  );
};

export default UsersPage;
