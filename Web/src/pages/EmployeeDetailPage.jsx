import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { LoadingSpinner } from '../components';
import { userService, departmentService } from '../services';

const EmployeeDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [department, setDepartment] = useState(null);
  const [approver, setApprover] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    try {
      const userData = await userService.getById(id);
      setUser(userData);

      // Fetch department name
      if (userData.departmentId) {
        try {
          const deptData = await departmentService.getById(userData.departmentId);
          setDepartment(deptData);
        } catch (error) {
          console.error('Failed to fetch department:', error);
        }
      }

      // Fetch approver
      try {
        const approverData = await userService.getApprover(id);
        if (approverData && approverData.approverId) {
          const approverUser = await userService.getById(approverData.approverId);
          setApprover(approverUser);
        }
      } catch (error) {
        console.log('No approver set for this user');
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      toast.error('Failed to load user data');
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this employee?')) {
      return;
    }

    try {
      await userService.deactivate(id);
      toast.success('Employee deactivated successfully');
      fetchUserData();
    } catch (error) {
      console.error('Failed to deactivate employee:', error);
      toast.error('Failed to deactivate employee');
    }
  };

  const handleActivate = async () => {
    if (!window.confirm('Are you sure you want to activate this employee?')) {
      return;
    }

    try {
      await userService.reactivate(id);
      toast.success('Employee activated successfully');
      fetchUserData();
    } catch (error) {
      console.error('Failed to activate employee:', error);
      toast.error('Failed to activate employee');
    }
  };

  const handleUpdate = () => {
    navigate(`/users/${id}/edit`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/users')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span>Employee Management</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">View Employee</h1>
        </div>

        {/* Form (Read-only) */}
        <div className="space-y-6">
          {/* Account Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={user.employeeId || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={user.email || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  value={
                    user.role
                      ? user.role.charAt(0).toUpperCase() +
                        user.role.slice(1).replace('_', ' ')
                      : ''
                  }
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <input
                  type="text"
                  value={
                    user.status
                      ? user.status.charAt(0).toUpperCase() + user.status.slice(1)
                      : ''
                  }
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={user.username || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="male"
                      checked={user.gender === 'male'}
                      disabled
                      className="mr-2"
                    />
                    <span className="text-sm">Male</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="female"
                      checked={user.gender === 'female'}
                      disabled
                      className="mr-2"
                    />
                    <span className="text-sm">Female</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={user.phoneNumber || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="text"
                  value={
                    user.dateOfBirth
                      ? new Date(user.dateOfBirth).toLocaleDateString()
                      : ''
                  }
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={user.address || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Work Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={department?.name || 'No department assigned'}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="text"
                  value={user.position || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Official Contract Date
                </label>
                <input
                  type="text"
                  value={
                    user.officialContractDate
                      ? new Date(user.officialContractDate).toLocaleDateString()
                      : ''
                  }
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Joining
                </label>
                <input
                  type="text"
                  value={
                    user.joinDate ? new Date(user.joinDate).toLocaleDateString() : ''
                  }
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Type
                </label>
                <input
                  type="text"
                  value={
                    user.contractType
                      ? user.contractType.charAt(0).toUpperCase() + user.contractType.slice(1).replace('_', ' ')
                      : ''
                  }
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Approver</label>
                <input
                  type="text"
                  value={approver?.username || 'No approver assigned'}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {user.status === 'inactive' ? (
              <button
                type="button"
                onClick={handleActivate}
                className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                Activate
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDeactivate}
                className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Deactivate
              </button>
            )}
            <button
              type="button"
              onClick={handleUpdate}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailPage;
