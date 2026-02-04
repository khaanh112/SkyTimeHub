import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const errorCode = searchParams.get('error');
      const errorMessage = searchParams.get('message');

      if (errorCode) {
        // Handle error cases from OAuth callback
        let displayMessage = errorMessage ? decodeURIComponent(errorMessage) : 'Đã xảy ra lỗi trong quá trình đăng nhập.';
        
        // Handle specific error codes with custom messages
        switch (errorCode) {
          case 'access_denied':
            displayMessage = 'Bạn đã từ chối quyền truy cập. Vui lòng thử lại và chấp nhận quyền để đăng nhập.';
            break;
          case 'ACCOUNT_NOT_INVITED':
            displayMessage = 'Tài khoản chưa được mời. Vui lòng liên hệ HR để được cấp quyền truy cập.';
            break;
          case 'ACCOUNT_NOT_ACTIVATED':
            displayMessage = 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email và nhấn vào link kích hoạt.';
            break;
          case 'ACCOUNT_INACTIVE':
            displayMessage = 'Tài khoản không hoạt động. Vui lòng liên hệ HR.';
            break;
        }
        
        setError(displayMessage);
        return;
      }

      if (accessToken && refreshToken) {
        await login(accessToken, refreshToken, false);
        navigate('/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">
              Đăng nhập thất bại
            </h2>
            <p className="text-center text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Quay lại trang đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-gray-600">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
