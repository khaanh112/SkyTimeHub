import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { LoadingSpinner } from '../components';
import { userService, departmentService, approverService } from '../services';

const ROLES = ['employee', 'hr', 'admin', 'department_leader', 'bod'];
const GENDERS = ['male', 'female'];

const EditEmployeePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [currentApproverId, setCurrentApproverId] = useState('');
  const [isDepartmentLeader, setIsDepartmentLeader] = useState(false);
  const [canBeLeader, setCanBeLeader] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [originalDepartmentId, setOriginalDepartmentId] = useState(null);
  const [originalRole, setOriginalRole] = useState('employee');

  const [formData, setFormData] = useState({
    employeeId: '',
    email: '',
    role: 'employee',
    status: 'inactive',
    username: '',
    gender: 'male',
    departmentId: '',
    position: '',
    officialContractDate: '',
    joinDate: '',
    approverId: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Step 1: Fetch departments first
        console.log('Fetching departments...');
        const deptData = await departmentService.getAll();
        console.log('Departments received:', deptData);
        const deptList = Array.isArray(deptData) ? deptData : [];
        setDepartments(deptList);
        
        // Step 2: Fetch approvers
        const users = await userService.getAll();
        const approverList = users.filter(
          (u) => u.role === 'department_leader' || u.role === 'hr' || u.role === 'admin'
        );
        setApprovers(approverList);
        
        // Step 3: Fetch user data
        console.log('Fetching user data for id:', id);
        const user = await userService.getById(id);
        console.log('User data received:', user);
        
        setFormData({
          employeeId: user.employeeId || '',
          email: user.email || '',
          role: user.role || 'employee',
          status: user.status || 'inactive',
          username: user.username || '',
          gender: user.gender || 'male',
          departmentId: user.departmentId || '',
          position: user.position || '',
          officialContractDate: user.officialContractDate
            ? new Date(user.officialContractDate).toISOString().split('T')[0]
            : '',
          joinDate: user.joinDate ? new Date(user.joinDate).toISOString().split('T')[0] : '',
          approverId: '',
        });

        setIsDepartmentLeader(user.role === 'department_leader');
        setOriginalDepartmentId(user.departmentId);
        setOriginalRole(user.role === 'department_leader' ? 'employee' : user.role);
        
        // Step 4: Check department leader availability (use deptList from Step 1)
        if (user.departmentId && deptList.length > 0) {
          const dept = deptList.find(d => d.id === user.departmentId);
          if (dept) {
            setSelectedDepartment(dept);
            // Can be leader if: no leader OR current user is the leader
            setCanBeLeader(!dept?.leaderId || dept?.leaderId === parseInt(id));
          }
        }

        // Step 5: Fetch current approver
        try {
          const approverData = await userService.getApprover(id);
          if (approverData && approverData.approverId) {
            setCurrentApproverId(approverData.approverId.toString());
            setFormData((prev) => ({ ...prev, approverId: approverData.approverId.toString() }));
          }
        } catch (error) {
          console.log('No approver set for this user');
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load user data');
        navigate('/users');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'departmentId') {
      setFormData((prev) => ({ ...prev, departmentId: value }));
      
      // Check if department has leader
      if (value) {
        const dept = departments.find(d => d.id === parseInt(value));
        setSelectedDepartment(dept);
        // Can be leader if: no leader OR current user is the leader
        setCanBeLeader(!dept?.leaderId || dept?.leaderId === parseInt(id));
        
        // If department already has another leader, uncheck and disable
        if (dept?.leaderId && dept?.leaderId !== parseInt(id)) {
          setIsDepartmentLeader(false);
          setFormData((prev) => ({ 
            ...prev, 
            departmentId: value,
            role: prev.role === 'department_leader' ? originalRole : prev.role,
            position: ''
          }));
        }
      } else {
        setCanBeLeader(false);
        setIsDepartmentLeader(false);
        setSelectedDepartment(null);
      }
    } else if (name === 'isDepartmentLeader' && type === 'checkbox') {
      setIsDepartmentLeader(checked);
      if (checked) {
        setFormData((prev) => ({ 
          ...prev, 
          role: 'department_leader',
          position: 'Department leader'
        }));
      } else {
        setFormData((prev) => ({ 
          ...prev,
          role: originalRole,
          position: ''
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSend = {
        username: formData.username,
        gender: formData.gender,
        role: formData.role,
      };

      // Department: send null if empty, otherwise send parsed int
      if (formData.departmentId && formData.departmentId !== '') {
        dataToSend.departmentId = parseInt(formData.departmentId);
      } else {
        dataToSend.departmentId = null;
      }

      // Position: only send if not empty (don't send null, DTO validation requires string)
      if (formData.position && formData.position.trim() !== '') {
        dataToSend.position = formData.position;
      }

      if (formData.joinDate) {
        dataToSend.joinDate = formData.joinDate;
      }

      if (formData.officialContractDate) {
        dataToSend.officialContractDate = formData.officialContractDate;
      }

      console.log('Sending data to update user:', dataToSend);
      await userService.update(id, dataToSend);

      // Update department leader based on checkbox
      if (formData.departmentId) {
        const deptId = parseInt(formData.departmentId);
        
        if (isDepartmentLeader) {
          // Set this user as department leader
          try {
            await departmentService.update(deptId, {
              leaderId: parseInt(id)
            });
            console.log('Department leader updated successfully');
          } catch (error) {
            console.error('Failed to set department leader:', error);
            toast.warning('User updated but failed to set as department leader');
          }
        } else if (originalDepartmentId === deptId) {
          // If unchecked and this is the original department, remove leader
          const dept = departments.find(d => d.id === deptId);
          if (dept?.leaderId === parseInt(id)) {
            try {
              await departmentService.update(deptId, {
                leaderId: null
              });
              console.log('Department leader removed successfully');
            } catch (error) {
              console.error('Failed to remove department leader:', error);
              toast.warning('User updated but failed to remove as department leader');
            }
          }
        }
      }

      // Update approver if changed
      if (formData.approverId && formData.approverId !== currentApproverId) {
        try {
          await approverService.setApprover(id, parseInt(formData.approverId));
        } catch (error) {
          console.error('Failed to update approver:', error);
          toast.warning('User updated but failed to update approver');
        }
      }

      toast.success('Employee updated successfully!');
      navigate('/users');
    } catch (error) {
      console.error('Failed to update employee:', error);
      console.error('Error details:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/users')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span>Employee Management</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Update Employee</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  readOnly
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  disabled={isDepartmentLeader}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <input
                  type="text"
                  value={formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                  readOnly
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 cursor-not-allowed"
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
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nguyen Van A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <div className="flex items-center space-x-4 mt-2">
                  {GENDERS.map((gender) => (
                    <label key={gender} className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value={gender}
                        checked={formData.gender === gender}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{gender}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Work Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  {Array.isArray(departments) &&
                    departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    name="position"
                    value={isDepartmentLeader ? 'Department leader' : formData.position}
                    onChange={handleInputChange}
                    disabled={isDepartmentLeader}
                    className={`flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDepartmentLeader ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                    }`}
                    placeholder="BA"
                  />
                  <label className="ml-3 flex items-center whitespace-nowrap">
                    <input
                      type="checkbox"
                      name="isDepartmentLeader"
                      checked={isDepartmentLeader}
                      onChange={handleInputChange}
                      disabled={!formData.departmentId || !canBeLeader}
                      className={`mr-2 ${!formData.departmentId || !canBeLeader ? 'cursor-not-allowed opacity-50' : ''}`}
                    />
                    <span className={`text-sm ${!formData.departmentId || !canBeLeader ? 'text-gray-400' : 'text-gray-900'}`}>
                      Department leader
                      {!formData.departmentId && ' (Chọn dept.)'}
                      {formData.departmentId && !canBeLeader && ' (Đã có leader)'}
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Official Contract Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="officialContractDate"
                  value={formData.officialContractDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Joining <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="joinDate"
                  value={formData.joinDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approver <span className="text-red-500">*</span>
                </label>
                <select
                  name="approverId"
                  value={formData.approverId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Approver</option>
                  {approvers.map((approver) => (
                    <option key={approver.id} value={approver.id}>
                      {approver.username}
                    </option>
                  ))}
                </select>
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
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {saving && <LoadingSpinner size="sm" />}
              <span>Update</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployeePage;
