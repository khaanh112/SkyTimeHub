import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { LoadingSpinner } from '../components';
import { userService, departmentService } from '../services';

const ROLES = ['employee', 'hr', 'admin'];
const GENDERS = ['male', 'female'];
const CONTRACT_TYPES = ['intern', 'probation', 'part_time', 'full_time'];

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
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    contractType: '',
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
          (u) => u.role === 'hr' || u.role === 'admin' 
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
          phoneNumber: user.phoneNumber || '',
          dateOfBirth: user.dateOfBirth
            ? new Date(user.dateOfBirth).toISOString().split('T')[0]
            : '',
          address: user.address || '',
          contractType: user.contractType || '',
        });

        setIsDepartmentLeader(user.position === 'Department leader');
        setOriginalDepartmentId(user.departmentId);
        
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
            position: prev.position === 'Department leader' ? '' : prev.position
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
        setFormData((prev) => ({ 
          ...prev,
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
        isDepartmentLeader: isDepartmentLeader,
      };

      // Department: send null if empty, otherwise send parsed int
      if (formData.departmentId && formData.departmentId !== '') {
        dataToSend.departmentId = parseInt(formData.departmentId);
      } else {
        dataToSend.departmentId = null;
      }

      // Position: send null to clear, or trimmed value (cannot send empty string, backend requires Length(1,100))
      dataToSend.position = formData.position?.trim() || null;

      if (formData.joinDate) {
        dataToSend.joinDate = formData.joinDate;
      }

      if (formData.officialContractDate) {
        dataToSend.officialContractDate = formData.officialContractDate;
      }

      // Approver: send if changed
      if (formData.approverId) {
        dataToSend.approverId = parseInt(formData.approverId);
      }

      // New fields
      dataToSend.phoneNumber = formData.phoneNumber?.trim() || null;
      dataToSend.dateOfBirth = formData.dateOfBirth || null;
      dataToSend.address = formData.address?.trim() || null;
      dataToSend.contractType = formData.contractType || null;

      console.log('Sending data to update user profile:', dataToSend);
      await userService.updateProfile(id, dataToSend);

      toast.success('Employee updated successfully!');
      navigate('/users');
    } catch (error) {
      console.error('Failed to update employee:', error);
      console.error('Error details:', error.response?.data);
      const data = error.response?.data;
      if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
        data.details.forEach((msg) => toast.error(msg));
      } else {
        toast.error(data?.message || 'Failed to update employee');
      }
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
  <div className="min-h-screen bg-slate-50 py-10">
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/users')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Employee Management</span>
        </button>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          Update Employee
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Account Information */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Account Information
            </h2>
          </div>

          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  readOnly
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-slate-600 placeholder:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-slate-600 placeholder:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <input
                  type="text"
                  value={formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                  readOnly
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Personal Details
            </h2>
          </div>

          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Nguyen Van A"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Gender
                </label>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {GENDERS.map((gender) => (
                    <label
                      key={gender}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={gender}
                        checked={formData.gender === gender}
                        onChange={handleInputChange}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <span className="capitalize">{gender}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="0901234567"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="123 Main St, Hanoi"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Work Information */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Work Information
            </h2>
          </div>

          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Position <span className="text-red-500">*</span>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    name="position"
                    value={isDepartmentLeader ? 'Department leader' : formData.position}
                    onChange={handleInputChange}
                    disabled={isDepartmentLeader}
                    className={`h-11 w-full flex-1 rounded-xl border border-slate-200 px-4 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 ${
                      isDepartmentLeader
                        ? 'bg-slate-100 text-slate-600 cursor-not-allowed'
                        : 'bg-white text-slate-900'
                    }`}
                    placeholder="BA"
                  />

                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      name="isDepartmentLeader"
                      checked={isDepartmentLeader}
                      onChange={handleInputChange}
                      disabled={!formData.departmentId || !canBeLeader}
                      className={`h-4 w-4 accent-blue-600 ${
                        !formData.departmentId || !canBeLeader ? 'cursor-not-allowed opacity-50' : ''
                      }`}
                    />
                    <span
                      className={`whitespace-nowrap ${
                        !formData.departmentId || !canBeLeader ? 'text-slate-400' : 'text-slate-700'
                      }`}
                    >
                      Department leader
                      {!formData.departmentId && ' (Chọn dept.)'}
                      {formData.departmentId && !canBeLeader && ' (Đã có leader)'}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Official Contract Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="officialContractDate"
                  value={formData.officialContractDate}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Date of Joining <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="joinDate"
                  value={formData.joinDate}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Contract Type
                </label>
                <select
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select Contract Type</option>
                  {CONTRACT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct.charAt(0).toUpperCase() + ct.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Approver <span className="text-red-500">*</span>
                </label>
                <select
                  name="approverId"
                  value={formData.approverId}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="h-11 rounded-xl border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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
