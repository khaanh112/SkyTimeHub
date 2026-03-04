import { useState, useEffect } from 'react';
import { User, Calendar, FileText, Clock } from 'lucide-react';
import { userService, leaveRequestService } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';

const LEAVE_TYPE_ICONS = {
  PAID: { icon: Calendar, bgColor: 'bg-green-50', iconColor: 'text-green-500', borderColor: 'border-green-100' },
  UNPAID: { icon: FileText, bgColor: 'bg-orange-50', iconColor: 'text-orange-500', borderColor: 'border-orange-100' },
  COMP: { icon: Clock, bgColor: 'bg-blue-50', iconColor: 'text-blue-500', borderColor: 'border-blue-100' },
};

const getLeaveTypeStyle = (code) => {
  return LEAVE_TYPE_ICONS[code] || { icon: Calendar, bgColor: 'bg-gray-50', iconColor: 'text-gray-500', borderColor: 'border-gray-100' };
};

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balanceSummary, setBalanceSummary] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(true);

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

    const fetchBalances = async () => {
      try {
        setBalanceLoading(true);
        const data = await leaveRequestService.getBalanceSummary();
        setBalanceSummary(data.data || data || []);
      } catch (error) {
        console.error('Failed to fetch balances:', error);
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchProfile();
    fetchBalances();
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

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatContractType = (value) => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, ' ');
  };

  const roleBadge = getRoleBadge(user.role);

  return (
    <div className="w-full space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* Profile Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-2xl text-white font-bold leading-none">
              {getInitials(user.username)}
            </span>
          </div>

          {/* Info Grid */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{user.username}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-3">
              {/* Row 1 */}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Employee ID</span>
                <span className="text-sm font-semibold text-gray-900">{user.employeeId || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Department</span>
                <span className="text-sm font-semibold text-gray-900">{user.departmentName || '—'}</span>
              </div>

              {/* Row 2 */}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Position</span>
                <span className="text-sm font-semibold text-gray-900">{user.position || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-semibold text-gray-900 truncate ml-4">{user.email}</span>
              </div>

              {/* Row 3 */}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Role</span>
                <span className="text-sm font-semibold text-gray-900">{roleBadge.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Contract type</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatContractType(user.contractType) || '—'}
                </span>
              </div>

              {/* Row 4 */}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Official Contract Date</span>
                <span className="text-sm font-semibold text-gray-900">
                  {user.officialContractDate
                    ? new Date(user.officialContractDate).toLocaleDateString('en-GB')
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Date of Joining</span>
                <span className="text-sm font-semibold text-gray-900">
                  {user.joinDate
                    ? new Date(user.joinDate).toLocaleDateString('en-GB')
                    : '—'}
                </span>
              </div>

              {/* Row 5 — Approver */}
              {user.approverName && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Approver</span>
                  <span className="text-sm font-semibold text-gray-900">{user.approverName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* My Leave Balances */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">My Leave Balances</h2>
        {balanceLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : balanceSummary.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {balanceSummary.map((balance) => {
              const style = getLeaveTypeStyle(balance.leaveTypeCode);
              const Icon = style.icon;
              const unit = (balance.unit === 'hours' || balance.leaveTypeCode === 'COMP') ? 'Hours' : 'Days';
              const remaining = balance.balance;
              const accruedToDate = balance.accruedToDate ?? balance.totalCredit;
              const used = balance.totalDebit;
              const annualLimit = balance.annualLimit;

              const monthlyAccrual = balance.monthlyAccrual;
              const isHardLimit = balance.isHardLimit;

              return (
                <div
                  key={balance.leaveTypeId}
                  className={`bg-white rounded-xl border ${style.borderColor} shadow-sm p-5`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${style.bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${style.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{balance.leaveTypeName}</h3>
                      {monthlyAccrual && (
                        <span className="text-xs text-gray-400">+{monthlyAccrual} {unit.toLowerCase()}/month</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Accrued / Entitlement */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {monthlyAccrual ? 'Accrued:' : isHardLimit === false ? 'Limit:' : 'Total:'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {monthlyAccrual
                          ? `${accruedToDate}/${annualLimit ?? accruedToDate} ${unit}`
                          : `${accruedToDate} ${unit}${!isHardLimit && balance.leaveTypeCode === 'UNPAID' ? '/year' : ''}`
                        }
                      </span>
                    </div>
                    {/* Used */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Used:</span>
                      <span className="text-sm font-medium text-gray-900">{used} {unit}</span>
                    </div>
                    {/* Remaining */}
                    <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Remaining:</span>
                      <span className={`text-base font-bold italic ${remaining <= 0 ? 'text-red-600' : remaining <= 3 ? 'text-red-500' : 'text-blue-600'}`}>
                        {remaining} {unit}
                      </span>
                    </div>
                    {/* Soft limit note */}
                    {isHardLimit === false && balance.leaveTypeCode === 'UNPAID' && (
                      <p className="text-xs text-amber-600 mt-1">* Soft limit — exceeding allowed with warning</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No leave balance data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
