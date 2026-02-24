import { useState, useEffect, useRef } from 'react';
import { X, Search, Check, Shield } from 'lucide-react';
import { userService } from '../services';

const UserMultiSelect = ({ selectedUserIds = [], onChange, excludeCurrentUser = false }) => {
  const [users, setUsers] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [approverId, setApproverId] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUsers();
    fetchApprover();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchApprover = async () => {
    try {
      const data = await userService.getCurrentApprover();
      setApproverId(data.approverId);
    } catch (error) {
      console.error('Error fetching approver:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAll();
      let allUsers = data;
      
      // Get current user
      let currentUserId = null;
      if (excludeCurrentUser) {
        const currentUserStr = localStorage.getItem('user');
        if (currentUserStr) {
          const currentUser = JSON.parse(currentUserStr);
          currentUserId = currentUser.id;
        }
      }
      
      // Separate HR users (pinned as default recipients)
      const hrList = allUsers.filter(u => u.role === 'hr');
      setHrUsers(hrList);
      
      // CC selectable list: exclude current user, HR users, and approver (filtered later)
      let userList = allUsers.filter(u => {
        if (u.role === 'hr') return false;
        if (currentUserId && u.id === currentUserId) return false;
        return true;
      });
      
      setUsers(userList);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setHrUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    // Exclude approver from selection (approver auto-receives notification)
    if (approverId && user.id === approverId) {
      return false;
    }
    // Apply search filter
    return (
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const selectedUsers = users.filter(user => selectedUserIds.includes(user.id));

  const handleToggleUser = (userId) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  const handleRemoveUser = (userId, e) => {
    e.stopPropagation();
    onChange(selectedUserIds.filter(id => id !== userId));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Additional Recipients (Optional)
        <span className="ml-1 text-xs text-gray-500 font-normal">
          - Your approver and HR will be notified automatically
        </span>
      </label>

      {/* Pinned HR recipients */}
      {hrUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {hrUsers.map(hr => (
            <span
              key={hr.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs"
              title={hr.email}
            >
              <Shield className="w-3 h-3" />
              <span className="font-medium">{hr.username}</span>
              <span className="text-emerald-500">HR</span>
            </span>
          ))}
        </div>
      )}
      
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-10.5 px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-pointer bg-white hover:border-gray-400 transition-colors"
      >
        {selectedUsers.length === 0 ? (
          <span className="text-gray-400">Select users to CC...</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map(user => (
              <span
                key={user.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm"
              >
                <span className="font-medium">{user.username}</span>
                <button
                  onClick={(e) => handleRemoveUser(user.id, e)}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Search */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* User List */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No users found</div>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => handleToggleUser(user.id)}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{user.username}</div>
                      {user.fullName && (
                        <div className="text-xs text-gray-500">{user.fullName}</div>
                      )}
                      {user.email && (
                        <div className="text-xs text-gray-400">{user.email}</div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-blue-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMultiSelect;
