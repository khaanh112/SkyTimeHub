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
              <h3 className="text-sm font-medium text-blue-900 mb-2">Yêu cầu định dạng Excel:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Giới hạn file</strong>: Tối đa 10MB, 1000 dòng</li>
                <li>• <strong>employeeId</strong> (bắt buộc): Mã nhân viên duy nhất (VD: EMP240001)</li>
                <li>• <strong>email</strong> (bắt buộc): Địa chỉ email hợp lệ</li>
                <li>• <strong>username</strong> (bắt buộc): Họ và tên đầy đủ</li>
                <li>• <strong>role</strong> (tùy chọn): admin, hr, employee, department_leader, bod</li>
                <li>• <strong>departmentId</strong> (tùy chọn): Số ID phòng ban</li>
                <li>• <strong>position</strong> (tùy chọn): Chức vụ công việc</li>
                <li>• <strong>joinDate</strong> (tùy chọn): Định dạng: YYYY-MM-DD</li>
                <li className="mt-2 pt-2 border-t border-blue-300">
                  <strong>⚠️ Lưu ý:</strong> Tất cả user import sẽ có trạng thái <strong className="text-red-700">inactive</strong> mặc định
                </li>
              </ul>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
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
                      <td className="px-4 py-3 text-sm text-gray-900">{row.role || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.position || '-'}</td>
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
