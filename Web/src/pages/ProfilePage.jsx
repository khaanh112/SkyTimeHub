import { useState, useEffect } from 'react';
import { User, Calendar, FileText, Clock } from 'lucide-react';
import { userService, leaveRequestService } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LEAVE_TYPE_CONFIG = {
  PAID: {
    icon: Calendar,
    bgColor: 'bg-green-50',
    iconColor: 'text-green-500',
    borderColor: 'border-green-100',
    remainingColor: 'text-green-500',
  },
  UNPAID: {
    icon: FileText,
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-500',
    borderColor: 'border-orange-100',
    remainingColor: 'text-orange-500',
  },
  COMP: {
    icon: Clock,
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-100',
    remainingColor: 'text-blue-500',
  },
};

const getLeaveTypeStyle = (code) =>
  LEAVE_TYPE_CONFIG[code] || {
    icon: Calendar,
    bgColor: 'bg-gray-50',
    iconColor: 'text-gray-500',
    borderColor: 'border-gray-100',
    remainingColor: 'text-blue-600',
  };

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Leave balance filters
  const [balanceSummary, setBalanceSummary] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceYear, setBalanceYear] = useState(currentYear);
  const [balanceMonth, setBalanceMonth] = useState(new Date().getMonth()); // 0-indexed

  // OT summary filters
  const [otYear, setOtYear] = useState(currentYear);
  const [otMonth, setOtMonth] = useState(new Date().getMonth());
  const [otSummary, setOtSummary] = useState({ today: 0, monthly: 0, yearly: 0 });
  const [otLoading, setOtLoading] = useState(true);

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

  useEffect(() => {
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
    fetchBalances();
  }, [balanceYear, balanceMonth]);

  useEffect(() => {
    const fetchOTSummary = async () => {
      try {
        setOtLoading(true);
        // TODO: Replace with real OT API call when available
        // e.g. await otService.getSummary({ year: otYear, month: otMonth + 1 })
        await new Promise((r) => setTimeout(r, 300));
        setOtSummary({ today: 0, monthly: 0, yearly: 0 });
      } catch (error) {
        console.error('Failed to fetch OT summary:', error);
      } finally {
        setOtLoading(false);
      }
    };
    fetchOTSummary();
  }, [otYear, otMonth]);

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

  const getRoleLabel = (role) => {
    const map = { admin: 'Admin', hr: 'HR', manager: 'Manager', employee: 'Employee' };
    return map[role] || 'Employee';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatContractType = (value) => {
    if (!value) return '—';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, ' ');
  };

  const formatDate = (val) =>
    val ? new Date(val).toLocaleDateString('en-GB') : '—';

  const FilterDropdowns = ({ year, onYearChange, month, onMonthChange }) => (
    <div className="flex items-center gap-2">
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onMonthChange(Number(e.target.value))}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
      >
        {MONTHS.map((m, i) => (
          <option key={i} value={i}>{m}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* Profile Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-md">
            <span className="text-2xl text-white font-bold leading-none">
              {getInitials(user.username)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{user.username}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Employee ID</span>
                <span className="text-sm font-semibold text-gray-900">{user.employeeId || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Department</span>
                <span className="text-sm font-semibold text-gray-900">{user.departmentName || '—'}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Position</span>
                <span className="text-sm font-semibold text-gray-900">{user.position || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Email</span>
                <span className="text-sm font-semibold text-gray-900 truncate ml-4">{user.email}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Role</span>
                <span className="text-sm font-semibold text-gray-900">{getRoleLabel(user.role)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Contract type</span>
                <span className="text-sm font-semibold text-gray-900">{formatContractType(user.contractType)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Official Contract Date</span>
                <span className="text-sm font-semibold text-gray-900">{formatDate(user.officialContractDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Date of Joining</span>
                <span className="text-sm font-semibold text-gray-900">{formatDate(user.joinDate)}</span>
              </div>

              {user.approverName && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Approver</span>
                  <span className="text-sm font-semibold text-gray-900">{user.approverName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* My Leave Balances */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">My Leave Balances</h2>
          <FilterDropdowns
            year={balanceYear}
            onYearChange={setBalanceYear}
            month={balanceMonth}
            onMonthChange={setBalanceMonth}
          />
        </div>

        {balanceLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : balanceSummary.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {balanceSummary.map((balance) => {
              const style = getLeaveTypeStyle(balance.leaveTypeCode);
              const Icon = style.icon;
              const unit = balance.unit === 'hours' || balance.leaveTypeCode === 'COMP' ? 'Hours' : 'Days';
              const remaining = balance.balance;
              const accruedToDate = balance.accruedToDate ?? balance.totalCredit;
              const used = balance.totalDebit;
              const annualLimit = balance.annualLimit;
              const monthlyAccrual = balance.monthlyAccrual;
              const isHardLimit = balance.isHardLimit;

              const remainingColor =
                remaining <= 0 ? 'text-red-500' : style.remainingColor;

              return (
                <div
                  key={balance.leaveTypeId}
                  className={`bg-white rounded-2xl border ${style.borderColor} shadow-sm p-5`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${style.bgColor} rounded-xl flex items-center justify-center`}>
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
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {monthlyAccrual ? 'Accrued:' : isHardLimit === false ? 'Limit:' : 'Total:'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {monthlyAccrual
                          ? `${accruedToDate}/${annualLimit ?? accruedToDate} ${unit}`
                          : `${accruedToDate} ${unit}${!isHardLimit && balance.leaveTypeCode === 'UNPAID' ? '/year' : ''}`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Used:</span>
                      <span className="text-sm font-medium text-gray-900">{used} {unit}</span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Remaining:</span>
                      <span className={`text-base font-bold italic ${remainingColor}`}>
                        {remaining} {unit}
                      </span>
                    </div>

                    {isHardLimit === false && balance.leaveTypeCode === 'UNPAID' && (
                      <p className="text-xs text-amber-600 mt-1">* Soft limit — exceeding allowed with warning</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No leave balance data available</p>
          </div>
        )}
      </div>

      {/* Overtime Summary */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Overtime Summary</h2>
          <FilterDropdowns
            year={otYear}
            onYearChange={setOtYear}
            month={otMonth}
            onMonthChange={setOtMonth}
          />
        </div>

        {otLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Today */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-sm text-gray-500 text-center">Total OT hours Today</p>
              <p className="text-3xl font-bold text-gray-900">{otSummary.today} Hours</p>
            </div>

            {/* Monthly */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-sm text-gray-500 text-center">
                Total OT Hours in {MONTHS[otMonth]}
              </p>
              <p className="text-3xl font-bold text-gray-900">{otSummary.monthly} Hours</p>
            </div>

            {/* Yearly */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-sm text-gray-500 text-center">
                Total OT hours in {otYear}
              </p>
              <p className="text-3xl font-bold text-gray-900">{otSummary.yearly} Hours</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
