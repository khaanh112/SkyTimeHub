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
} from 'lucide-react';
import { toast } from 'react-toastify';
import { LoadingSpinner, Modal } from '../components';
import { userService, approverService } from '../services';
import { useAuth } from '../context';

const ROLES = ['admin', 'hr', 'employee'];
const STATUSES = ['pending', 'active', 'inactive'];
const GENDERS = ['male', 'female'];

const UsersPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSetApproverModalOpen, setIsSetApproverModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedApproverId, setSelectedApproverId] = useState('');
  const [currentApprovers, setCurrentApprovers] = useState([]);
  const [potentialApprovers, setPotentialApprovers] = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    username: '',
    email: '',
    gender: 'male',
    role: 'employee',
    status: 'pending',
    position: '',
    joinDate: '',
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

  useEffect(() => {
    fetchUsers();
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
      position: '',
      joinDate: '',
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      // Prepare data - remove empty optional fields
      const dataToSend = {
        employeeId: formData.employeeId,
        username: formData.username,
        email: formData.email,
        gender: formData.gender,
        role: formData.role,
      };
      
      if (formData.position) {
        dataToSend.position = formData.position;
      }
      
      if (formData.joinDate) {
        dataToSend.joinDate = formData.joinDate;
      }
      
      await userService.create(dataToSend);
      toast.success('Tạo user thành công!');
      setIsCreateModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error(error.response?.data?.message || 'Không thể tạo user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormLoading(true);
    try {
      // Prepare data - only send fields that can be updated
      const dataToSend = {
        username: formData.username,
        gender: formData.gender,
        role: formData.role,
      };
      
      if (formData.position !== undefined) {
        dataToSend.position = formData.position;
      }
      
      if (formData.joinDate) {
        dataToSend.joinDate = formData.joinDate;
      }
      
      await userService.update(selectedUser.id, dataToSend);
      toast.success('Cập nhật user thành công!');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error.response?.data?.message || 'Không thể cập nhật user');
    } finally {
      setFormLoading(false);
    }
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

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      employeeId: user.employeeId || '',
      username: user.username || '',
      email: user.email || '',
      gender: user.gender || 'male',
      role: user.role || 'employee',
      status: user.status || 'pending',
      position: user.position || '',
      joinDate: user.joinDate ? new Date(user.joinDate).toISOString().split('T')[0] : '',
    });
    setIsEditModalOpen(true);
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

  const handleReactivate = async (user) => {
    if (!window.confirm(`Reactivate user ${user.username}?`)) {
      return;
    }
    try {
      await userService.reactivate(user.id);
      toast.success('Đã reactivate user thành công!');
      fetchUsers();
    } catch (error) {
      console.error('Failed to reactivate user:', error);
      toast.error('Không thể reactivate user');
    }
  };

  const openSetApproverModal = async (user) => {
    setSelectedUser(user);
    setSelectedApproverId('');
    setIsSetApproverModalOpen(true);
    
    setLoadingApprovers(true);
    try {
      // Fetch current approvers for the user
      const approvers = await approverService.getApproversForUser(user.id);
      setCurrentApprovers(approvers);
      if (approvers.length > 0) {
        setSelectedApproverId(approvers[0].id.toString());
      }

      // Fetch list of potential approvers (active admin/hr users)
      const allUsers = await userService.getAll();
      const filteredApprovers = allUsers.filter(
        (u) => 
          u.status === 'active' && 
          u.id !== user.id &&
          (u.role === 'admin' || u.role === 'hr')
      );
      setPotentialApprovers(filteredApprovers);
    } catch (error) {
      console.error('Failed to fetch approvers:', error);
      setCurrentApprovers([]);
      setPotentialApprovers([]);
    } finally {
      setLoadingApprovers(false);
    }
  };

  const handleSetApprover = async () => {
    if (!selectedUser || !selectedApproverId) {
      toast.error('Vui lòng chọn approver');
      return;
    }

    if (selectedApproverId === selectedUser.id.toString()) {
      toast.error('User không thể là approver của chính mình');
      return;
    }

    setFormLoading(true);
    try {
      await approverService.setApproverForUser(
        selectedUser.id, 
        parseInt(selectedApproverId),
        currentUser.id
      );
      toast.success('Đã set approver thành công!');
      setIsSetApproverModalOpen(false);
      setSelectedUser(null);
      setSelectedApproverId('');
      setCurrentApprovers([]);
      setPotentialApprovers([]);
    } catch (error) {
      console.error('Failed to set approver:', error);
      toast.error(error.response?.data?.message || 'Không thể set approver');
    } finally {
      setFormLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Users</h1>
          <p className="text-gray-500 mt-1">
            Quản lý tất cả users trong hệ thống
          </p>
        </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/users/import')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors shadow-sm border border-gray-200"
            >
              <Upload className="w-5 h-5" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-600/30"
            >
              <Plus className="w-5 h-5" />
              <span>Thêm User</span>
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
                <option value="">Tất cả Role</option>
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
              <option value="">Tất cả Status</option>
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
                              <button
                                onClick={() => handleDeactivate(user)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Deactivate Account"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {user.status === 'active' && (
                            <button
                              onClick={() => handleDeactivate(user)}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Deactivate Account"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                          {user.status === 'inactive' && (
                            <button
                              onClick={() => handleReactivate(user)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Reactivate Account"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Set Approver button - visible for active users */}
                          {user.status === 'active' && (
                            <button
                              onClick={() => openSetApproverModal(user)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Set Approver"
                            >
                              <UserCog className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Edit button - always visible */}
                          <button
                            onClick={() => openEditModal(user)}
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

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Thêm User mới"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID *
              </label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="VD: EMP001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="VD: Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Join Date
                </label>
                <input
                  type="date"
                  name="joinDate"
                  value={formData.joinDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status (mặc định: Pending)
                </label>
                <input
                  type="text"
                  value="Pending"
                  readOnly
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {formLoading && <LoadingSpinner size="sm" />}
                <span>Tạo User</span>
              </button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
          }}
          title="Chỉnh sửa User"
        >
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID * (không thể chỉnh sửa)
              </label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                readOnly
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email * (không thể chỉnh sửa)
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                readOnly
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="VD: Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Join Date
                </label>
                <input
                  type="date"
                  name="joinDate"
                  value={formData.joinDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                {formData.status === 'pending' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value="Pending (chỉ có thể kích hoạt qua link)"
                      readOnly
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleGetActivationLink(selectedUser)}
                        className="px-3 py-2 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-center space-x-1"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>Get Link</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetActivationToken(selectedUser)}
                        className="px-3 py-2 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg transition-colors flex items-center justify-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset Token</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleResendActivationLink(selectedUser);
                          setIsEditModalOpen(false);
                          setSelectedUser(null);
                        }}
                        className="px-3 py-2 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center space-x-1"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Send Email</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleDeactivate(selectedUser);
                        setIsEditModalOpen(false);
                        setSelectedUser(null);
                      }}
                      className="w-full px-3 py-2 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <UserX className="w-3 h-3" />
                      <span>Deactivate Account</span>
                    </button>
                  </div>
                ) : formData.status === 'active' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value="Active"
                      readOnly
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-green-100 text-green-700 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleDeactivate(selectedUser);
                        setIsEditModalOpen(false);
                        setSelectedUser(null);
                      }}
                      className="w-full px-3 py-2 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <UserX className="w-3 h-3" />
                      <span>Deactivate Account</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value="Inactive"
                      readOnly
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleReactivate(selectedUser);
                        setIsEditModalOpen(false);
                        setSelectedUser(null);
                      }}
                      className="w-full px-3 py-2 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Reactivate Account</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {formLoading && <LoadingSpinner size="sm" />}
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </form>
        </Modal>

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

        {/* Set Approver Modal */}
        <Modal
          isOpen={isSetApproverModalOpen}
          onClose={() => {
            setIsSetApproverModalOpen(false);
            setSelectedUser(null);
            setSelectedApproverId('');
            setCurrentApprovers([]);
            setPotentialApprovers([]);
          }}
          title="Set Approver"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>User:</strong> {selectedUser?.username} ({selectedUser?.email})
              </p>
            </div>

            {loadingApprovers ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <>
                {currentApprovers.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-800 font-medium mb-2">
                      Current Approver:
                    </p>
                    <p className="text-sm text-green-700">
                      {currentApprovers[0].username} ({currentApprovers[0].email})
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chọn Approver *
                  </label>
                  <select
                    value={selectedApproverId}
                    onChange={(e) => setSelectedApproverId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- Chọn approver --</option>
                    {potentialApprovers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} ({user.email}) - {user.role}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Chỉ hiển thị active users với role admin hoặc hr
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsSetApproverModalOpen(false);
                  setSelectedUser(null);
                  setSelectedApproverId('');
                  setCurrentApprovers([]);
                  setPotentialApprovers([]);
                }}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSetApprover}
                disabled={formLoading || loadingApprovers || !selectedApproverId}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {formLoading && <LoadingSpinner size="sm" />}
                <UserCog className="w-4 h-4" />
                <span>Set Approver</span>
              </button>
            </div>
          </div>
        </Modal>
      </div>
  );
};

export default UsersPage;
