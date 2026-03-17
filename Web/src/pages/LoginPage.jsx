import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Send, Clock } from 'lucide-react';
import { authService } from '../services';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { LoadingSpinner } from '../components';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [resending, setResending] = useState(false);

  const handleZohoLogin = () => {
    window.location.href = authService.getZohoLoginUrl();
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Vui lòng nhập email');
      return;
    }
    setPendingEmail(null);
    setLoading(true);
    try {
      const response = await authService.loginWithEmail(email);
      login(response.accessToken, response.refreshToken);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
      const errorCode = error.response?.data?.code;
      if (errorCode === 'ACCOUNT_NOT_ACTIVATED') {
        setPendingEmail(email);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendActivation = async () => {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const result = await authService.resendActivationEmail(pendingEmail);
      toast.success(result.message || 'Email kích hoạt đã được gửi!');
    } catch (error) {
      console.error('Resend failed:', error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0edff] via-[#f9fafb] to-[#ede9fe] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7C5FF7] shadow-lg shadow-purple-200 mb-4">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 tracking-wide">SKY CORPORATION</h1>
          <p className="text-xs text-gray-500 mt-0.5">Leave & Overtime Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-purple-100/60 border border-purple-100 p-6">
          {/* Zoho Login */}
          <button
            onClick={handleZohoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#7C5FF7] text-white font-semibold text-sm hover:bg-[#6b4fe6] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-purple-200"
          >
            <Mail className="w-4 h-4" />
            <span>Đăng nhập bằng Zoho Mail</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">hoặc</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Email Login */}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@skycompany.com"
                disabled={loading}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C5FF7]/20 focus:border-[#7C5FF7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl border border-[#7C5FF7] text-[#7C5FF7] font-semibold text-sm hover:bg-[#7C5FF7]/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span>Đang xử lý...</span>
                </span>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          {/* Pending activation */}
          {pendingEmail && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800 mb-2">
                Tài khoản <strong>{pendingEmail}</strong> chưa được kích hoạt.
              </p>
              <button
                onClick={handleResendActivation}
                disabled={resending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Gửi lại email kích hoạt</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
