import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Download } from 'lucide-react';
import userService from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';

const ImportUsersPage = () => {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      const validExtensions = ['.xlsx', '.xls'];
      const hasValidExtension = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));
      
      if (!hasValidExtension && !validTypes.includes(selectedFile.type)) {
        toast.error('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
        e.target.value = ''; // Reset input
        return;
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > maxSize) {
        toast.error('File size exceeds 10MB limit. Please upload a smaller file.');
        e.target.value = ''; // Reset input
        return;
      }

      // Validate file is not empty
      if (selectedFile.size === 0) {
        toast.error('File is empty. Please upload a valid Excel file.');
        e.target.value = ''; // Reset input
        return;
      }

      setFile(selectedFile);
      setPreviewData(null);
      
      // Auto preview after file is selected
      await handlePreview(selectedFile);
    }
  };

  const handlePreview = async (selectedFile = null) => {
    const fileToPreview = selectedFile || file;
    if (!fileToPreview) {
      toast.error('Please select a file first');
      return;
    }

    setIsLoading(true);
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      let result;
      try {
        result = await userService.previewImport(fileToPreview, controller.signal);
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout. File may be too large or corrupted.');
        }
        throw fetchError;
      }

      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from server');
      }

      setPreviewData(result);
      
      // Display appropriate message based on validation results
      if (result.invalidRows > 0 && result.validRows === 0) {
        toast.error(`All ${result.invalidRows} rows have errors. Please fix them before importing`);
      } else if (result.invalidRows > 0) {
        toast.warning(`Found ${result.validRows} valid and ${result.invalidRows} invalid rows`);
      } else if (result.totalRows === 1) {
        toast.success('Preview loaded: 1 valid row ready to import');
      } else {
        toast.success(`Preview loaded: ${result.totalRows} valid rows ready to import`);
      }
    } catch (error) {
      console.error('Preview error:', error);
      
      // Extract error message from different sources
      let errorMessage = 'Failed to preview import. Please try again.';
      
      if (error.response?.data) {
        // Server responded with error
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'No response from server. Please check your connection.';
      } else if (error.message) {
        // Other errors (network, timeout, etc.)
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!previewData || previewData.validRows === 0) {
      toast.error('No valid rows to import');
      return;
    }

    // Confirm before importing
    if (!window.confirm(`Import ${previewData.validRows} users?`)) {
      return;
    }

    setIsImporting(true);
    try {
      const validRows = previewData.rows.filter(row => 
        row && Array.isArray(row.errors) && row.errors.length === 0
      );

      if (validRows.length === 0) {
        throw new Error('No valid rows found');
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for import

      let result;
      try {
        result = await userService.executeImport(validRows, controller.signal);
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Import timeout. Please try with fewer rows.');
        }
        throw fetchError;
      }

      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from server');
      }
      
      if (result.success) {
        const message = result.successCount === 1 
          ? 'Successfully imported 1 user'
          : `Successfully imported ${result.successCount} users`;
        toast.success(message);
        
        setFile(null);
        setPreviewData(null);
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
      } else {
        // Partial success
        if (result.successCount > 0 && result.failedCount > 0) {
          toast.warning(`Imported ${result.successCount} users successfully, ${result.failedCount} failed`);
        } else if (result.successCount > 0) {
          toast.success(`Successfully imported ${result.successCount} users`);
        } else {
          toast.error('Import failed. No users were imported');
        }
        
        // Show error details if available
        if (result.errors && result.errors.length > 0) {
          console.error('Import errors:', result.errors);
          // Show first error as example
          if (result.errors[0]?.error) {
            toast.error(`Example error: ${result.errors[0].error}`);
          }
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      
      // Extract error message from different sources
      let errorMessage = 'Failed to import users. Please try again.';
      
      if (error.response?.data) {
        // Server responded with error
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'No response from server. Please check your connection.';
      } else if (error.message) {
        // Other errors (network, timeout, etc.)
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    try {
      // Download Excel template
      const link = document.createElement('a');
      link.href = '/templates/users-import-template.xlsx';
      link.download = 'users-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Đã tải xuống template Excel');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download template. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload Excel file to import multiple users at once
          </p>
        </div>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </button>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Excel File
              </label>
              <label className="flex items-center justify-center px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <div className="space-y-2 text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    {file ? (
                      <span className="font-medium text-blue-600">{file.name}</span>
                    ) : (
                      <>
                        <span className="font-medium text-blue-600">Click to upload</span>
                        <span className="text-gray-500"> or drag and drop</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">XLSX or XLS files only</p>
                  {isLoading && <p className="text-xs text-blue-600">Processing...</p>}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
              </label>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">📋 Hướng dẫn Import nhân viên từ Excel:</h3>
              <p className="text-sm text-blue-800 mb-3">Tải template Excel ở góc trên bên phải, điền thông tin và upload lại. Hệ thống sẽ kiểm tra dữ liệu trước khi import.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Required fields */}
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">🔴 Cột bắt buộc:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>email</strong>: Địa chỉ email hợp lệ</li>
                    <li>• <strong>username</strong>: Họ và tên đầy đủ</li>
                    <li>• <strong>gender</strong>: <code className="bg-blue-100 px-1 rounded">male</code> hoặc <code className="bg-blue-100 px-1 rounded">female</code> (hoặc: M, F, Nam, Nữ)</li>
                  </ul>
                </div>

                {/* Optional fields */}
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">🔵 Cột tùy chọn:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>employeeId</strong>: Mã nhân viên (VD: SG100) - tự động tạo nếu để trống</li>
                    <li>• <strong>phoneNumber</strong>: Số điện thoại</li>
                    <li>• <strong>dateOfBirth</strong>: Ngày sinh (YYYY-MM-DD)</li>
                    <li>• <strong>address</strong>: Địa chỉ</li>
                    <li>• <strong>role</strong>: <code className="bg-blue-100 px-1 rounded">admin</code>, <code className="bg-blue-100 px-1 rounded">hr</code>, <code className="bg-blue-100 px-1 rounded">employee</code> (mặc định: employee)</li>
                    <li>• <strong>position</strong>: Chức vụ (VD: Software Engineer)</li>
                    <li>• <strong>joinDate</strong>: Ngày vào làm (YYYY-MM-DD)</li>
                    <li>• <strong>officialContractDate</strong>: Ngày ký HĐ chính thức (YYYY-MM-DD)</li>
                    <li>• <strong>contractType</strong>: <code className="bg-blue-100 px-1 rounded">intern</code>, <code className="bg-blue-100 px-1 rounded">probation</code>, <code className="bg-blue-100 px-1 rounded">part_time</code>, <code className="bg-blue-100 px-1 rounded">full_time</code></li>
                  </ul>
                </div>
              </div>

              {/* Department section - highlighted */}
              <div className="mt-3 pt-3 border-t border-blue-300">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">🏢 Phòng ban (cột <strong>department</strong>):</h4>
                <p className="text-sm text-blue-800 mb-2">Nhập <strong>tên phòng ban</strong> vào cột <code className="bg-blue-100 px-1 rounded">department</code>. Các giá trị hợp lệ:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { code: 'HR_ADMIN', label: 'Hành chính Nhân sự' },
                    { code: 'ACCOUNTING', label: 'Kế toán' },
                    { code: 'EMAIL_SERVICE', label: 'Email Service' },
                    { code: 'RND_CENTER', label: 'Trung tâm R&D' },
                    { code: 'MARKETING', label: 'Marketing' },
                    { code: 'SALES_SUPPORT', label: 'Sale Support' },
                    { code: 'SALES_SOLUTION', label: 'Sale Solution' },
                    { code: 'FULFILLMENT', label: 'Fulfillment' },
                    { code: 'TECH_SUPPORT', label: 'Tech Support' },
                    { code: 'TECH_DEV_CENTER', label: 'TTPTCN' },
                    { code: 'EXECUTIVE_OFFICE', label: 'VP Chủ tịch' },
                  ].map(dept => (
                    <span key={dept.code} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-xs text-blue-800">
                      <strong>{dept.code}</strong>
                      <span className="ml-1 text-blue-600">({dept.label})</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-blue-300">
                <p className="text-sm text-blue-800">
                  <strong>⚠️ Lưu ý:</strong> Tất cả user import sẽ có trạng thái <strong className="text-orange-700">pending</strong> và sẽ nhận email kích hoạt tài khoản.
                  Giới hạn: tối đa <strong>10MB</strong>, <strong>1000 dòng</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Results */}
        {previewData && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Summary */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      Total: {previewData.totalRows} rows
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      Valid: {previewData.validRows}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                      Invalid: {previewData.invalidRows}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleImport}
                  disabled={previewData.validRows === 0 || isImporting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isImporting ? 'Importing...' : `Import ${previewData.validRows} Users`}
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gender</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DOB</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Errors</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.rows.map((row) => (
                    <tr key={row.rowNumber} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.rowNumber}</td>
                      <td className="px-4 py-3">
                        {row.errors.length === 0 ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.employeeId || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.username}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          row.gender === 'male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.phoneNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.dateOfBirth || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {row.departmentName ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {row.departmentName}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.position || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.role || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {row.contractType
                          ? row.contractType.charAt(0).toUpperCase() + row.contractType.slice(1).replace('_', ' ')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {row.errors.length > 0 ? (
                          <div className="flex items-start space-x-1">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <ul className="text-xs text-red-600 space-y-1">
                              {row.errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <span className="text-sm text-green-600">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}
      </div>
  );
};

export default ImportUsersPage;
