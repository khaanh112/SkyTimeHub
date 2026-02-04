import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services';
import { LoadingSpinner } from '../components';

const ActivateAccountPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    const activateAccount = async () => {
      if (!token) {
        setStatus('error');
        setError('Liên kết kích hoạt không hợp lệ.');
        return;
      }

      try {
        setStatus('loading');
        await authService.activateAccount(token);

        setStatus('success');

        // Redirect to login page after 3 seconds
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      } catch (err) {
        setStatus('error');
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Không thể kích hoạt tài khoản. Liên kết có thể đã hết hạn hoặc không hợp lệ.';
        setError(errorMessage);
      }
    };

    activateAccount();
  }, [token, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">Đang kích hoạt tài khoản...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">
              Kích hoạt thành công!
            </h2>
            <p className="text-center text-gray-600 mb-4">
              Tài khoản của bạn đã được kích hoạt thành công. Bạn sẽ được chuyển đến trang đăng nhập
              trong giây lát...
            </p>
            <div className="flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
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
            Kích hoạt thất bại
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
};

export default ActivateAccountPage;
