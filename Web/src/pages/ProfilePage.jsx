import { useState, useEffect } from 'react';
import { User, Mail, Briefcase, Phone, Calendar, Shield, CheckCircle, XCircle, Building2, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';

const ProfilePage = () => {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userService.getCurrentProfile();
        setUser(data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast.error('Không thể tải thông tin hồ sơ');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Không tìm thấy thông tin người dùng</p>
        </div>
      </div>
    );
  }

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700' },
      hr: { label: 'HR', color: 'bg-blue-100 text-blue-700' },
      manager: { label: 'Manager', color: 'bg-green-100 text-green-700' },
      employee: { label: 'Employee', color: 'bg-gray-100 text-gray-700' },
    };
    return roleConfig[role] || roleConfig.employee;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'Hoạt động', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      inactive: { label: 'Chưa kích hoạt', color: 'bg-yellow-100 text-yellow-700', icon: XCircle },
    };
    return statusConfig[status] || statusConfig.inactive;
  };

  const roleBadge = getRoleBadge(user.role);
  const statusBadge = getStatusBadge(user.status);
  const StatusIcon = statusBadge.icon;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-32 bg-linear-to-r from-blue-500 to-blue-600"></div>
        <div className="px-8 pb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-16 mb-6">
            <div className="w-32 h-32 bg-linear-to-br from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg border-4 border-white">
              <span className="text-4xl text-white font-bold">
                {user.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-6 flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{user.username}</h1>
              <p className="text-gray-500 mt-1">{user.email}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleBadge.color}`}>
                  <Shield className="w-4 h-4 mr-1.5" />
                  {roleBadge.label}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
                  <StatusIcon className="w-4 h-4 mr-1.5" />
                  {statusBadge.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Information Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
          <User className="w-5 h-5 mr-2 text-blue-500" />
          Thông tin cá nhân
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee ID */}
          {user.employeeId && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Mã nhân viên</p>
                <p className="text-base font-semibold text-gray-900 mt-1">{user.employeeId}</p>
              </div>
            </div>
          )}

          {/* Email */}
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-base font-semibold text-gray-900 mt-1 break-all">{user.email}</p>
            </div>
          </div>

          {/* Phone Number */}
          {user.phoneNumber && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Số điện thoại</p>
                <p className="text-base font-semibold text-gray-900 mt-1">{user.phoneNumber}</p>
              </div>
            </div>
          )}

          {/* Date of Birth */}
          {user.dateOfBirth && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Ngày sinh</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {new Date(user.dateOfBirth).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          )}

          {/* Address */}
          {user.address && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-teal-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Địa chỉ</p>
                <p className="text-base font-semibold text-gray-900 mt-1">{user.address}</p>
              </div>
            </div>
          )}

          {/* Contract Type */}
          {user.contractType && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Loại hợp đồng</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {user.contractType.charAt(0).toUpperCase() + user.contractType.slice(1).replace('_', ' ')}
                </p>
              </div>
            </div>
          )}

         

      
          
          {/* Position */}
          {user.position && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Vị trí</p>
                <p className="text-base font-semibold text-gray-900 mt-1">{user.position}</p>
              </div>
            </div>
          )}

         

          {/* Join Date */}
          {user.joinDate && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Ngày tham gia</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {new Date(user.joinDate).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          )}
          {/* officialContractDate */}
          {user.officialContractDate && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Ngày tham gia chính thức</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {new Date(user.officialContractDate).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          )}

          {/* Activated At */}
          {user.activatedAt && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Kích hoạt lúc</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {new Date(user.activatedAt).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          )}

          {/* Created At */}
          {user.createdAt && (
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Tạo lúc</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {new Date(user.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
