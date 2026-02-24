import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { LoadingSpinner } from '../components';
import { userService, departmentService } from '../services';

const ROLES = ['employee', 'hr', 'admin'];
const GENDERS = ['male', 'female'];
const CONTRACT_TYPES = ['intern', 'probation', 'part_time', 'full_time'];

const AddEmployeePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [isDepartmentLeader, setIsDepartmentLeader] = useState(false);
  const [canBeLeader, setCanBeLeader] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const [formData, setFormData] = useState({
    employeeId: '',
    email: '',
    role: 'employee',
    username: '',
    gender: 'male',
    departmentId: '',
    position: '',
    officialContractDate: '',
    joinDate: '',
    approverId: '',
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    contractType: '',
  });

  useEffect(() => {
    fetchDepartments();
    fetchApprovers();
  }, []);

  const fetchDepartments = async () => {
    try {
      console.log('Fetching departments...');
      const data = await departmentService.getAll();
      console.log('Departments received:', data);
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      console.error('Error details:', error.response?.data);
      setDepartments([]);
      toast.error('Failed to load departments');
    }
  };

  const fetchApprovers = async () => {
    try {
      const users = await userService.getAll();
      const approverList = users.filter(
        (u) => u.role === 'hr' || u.role === 'admin'
      );
      setApprovers(approverList);
    } catch (error) {
      console.error('Failed to fetch approvers:', error);
      setApprovers([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'departmentId') {
      setFormData((prev) => ({ ...prev, departmentId: value }));
      
      // Check if department has leader
      if (value) {
        const dept = departments.find(d => d.id === parseInt(value));
        setSelectedDepartment(dept);
        setCanBeLeader(!dept?.leaderId); // Can be leader only if department has no leader
        
        // If department already has leader, uncheck and disable
        if (dept?.leaderId) {
          setIsDepartmentLeader(false);
          setFormData((prev) => ({ 
            ...prev, 
            departmentId: value,
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
          position: 'Department leader'
        }));
      } else {
        // When unchecking, just clear position and let user select role from dropdown
        setFormData((prev) => ({ 
          ...prev, 
          position: ''
          // Don't change role here - let user select from dropdown
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSend = {
        employeeId: formData.employeeId,
        email: formData.email,
        username: formData.username,
        gender: formData.gender,
        role: formData.role,
        isDepartmentLeader: isDepartmentLeader,
      };

      if (formData.departmentId) {
        dataToSend.departmentId = parseInt(formData.departmentId);
      }

      if (formData.position && formData.position.trim() !== '') {
        dataToSend.position = formData.position;
      }

      if (formData.joinDate) {
        dataToSend.joinDate = formData.joinDate;
      }

      if (formData.officialContractDate) {
        dataToSend.officialContractDate = formData.officialContractDate;
      }

      if (formData.approverId) {
        dataToSend.approverId = parseInt(formData.approverId);
      }

      if (formData.phoneNumber && formData.phoneNumber.trim() !== '') {
        dataToSend.phoneNumber = formData.phoneNumber.trim();
      }

      if (formData.dateOfBirth) {
        dataToSend.dateOfBirth = formData.dateOfBirth;
      }

      if (formData.address && formData.address.trim() !== '') {
        dataToSend.address = formData.address.trim();
      }

      if (formData.contractType) {
        dataToSend.contractType = formData.contractType;
      }

      await userService.createProfile(dataToSend);

      toast.success('Employee created successfully!');
      navigate('/users');
    } catch (error) {
      console.error('Failed to create employee:', error);
      toast.error(error.response?.data?.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Add New Employee</h1>
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
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ST100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="john.doe@company.com"
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
                  value="Inactive"
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
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0901234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Main St, Hanoi"
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
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  {Array.isArray(departments) && departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position <span className="text-red-500">*</span>
                  <div className="flex items-center mt-1">
                    <input
                      type="checkbox"
                      name="isDepartmentLeader"
                      checked={isDepartmentLeader}
                      onChange={handleInputChange}
                      disabled={!formData.departmentId || !canBeLeader}
                      className={`mr-2 ${!formData.departmentId || !canBeLeader ? 'cursor-not-allowed opacity-50' : ''}`}
                    />
                    <span className={`text-xs ${!formData.departmentId || !canBeLeader ? 'text-gray-400' : 'text-gray-600'}`}>
                      Department leader
                      {!formData.departmentId && ' (Chọn department trước)'}
                      {formData.departmentId && !canBeLeader && ' (Department đã có leader)'}
                    </span>
                  </div>
                </label>
                <input
                  type="text"
                  name="position"
                  value={isDepartmentLeader ? 'Department leader' : formData.position}
                  onChange={handleInputChange}
                  disabled={isDepartmentLeader}
                  className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDepartmentLeader ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                  }`}
                  placeholder="BA"
                />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Type
                </label>
                <select
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Contract Type</option>
                  {CONTRACT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct.charAt(0).toUpperCase() + ct.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
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
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              <span>Create & Invite</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEmployeePage;
