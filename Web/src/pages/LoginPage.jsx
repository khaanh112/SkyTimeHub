import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Send } from 'lucide-react';
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
    <div className="min-h-screen bg-[#F9FAFB] border-2 border-[#CED4DA] rounded-lg flex items-center justify-center px-4 py-8 sm:p-8">
      <div className="w-full max-w-3xl">
        <div className="bg-[#7C5FF7] border border-[#7C5FF7] rounded-[20px] px-6 sm:px-12 py-10 sm:py-14 text-center">
          <div className="mx-auto mb-8 sm:mb-10 flex items-center justify-center">
            <div className="text-white text-3xl sm:text-4xl font-bold tracking-[0.18em]">SKY CORPORATION</div>
          </div>

          <h1 className="text-[#E5E7EB] text-3xl sm:text-5xl leading-tight font-bold">
            Leave & Overtime
            <br />
            Management System
          </h1>

          <button
            onClick={handleZohoLogin}
            disabled={loading}
            className="mt-10 sm:mt-12 mx-auto w-full max-w-md h-24 rounded-[20px] bg-white border border-[#7C5FF7] text-[#7C5FF7] font-bold text-xl sm:text-2xl leading-7 flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#7C5FF7]">
              <Mail className="w-5 h-5" />
            </span>
            <span>Login with Zoho mail</span>
          </button>
        </div>

        <div className="mt-5 bg-white border border-[#CED4DA] rounded-2xl p-4 sm:p-5">
          <form onSubmit={handleEmailLogin} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Đăng nhập bằng Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@skycompany.com"
                disabled={loading}
                className="w-full px-4 py-3 border border-[#CED4DA] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C5FF7]/30 focus:border-[#7C5FF7] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-12.5 px-6 rounded-xl bg-[#7C5FF7] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span>Đang xử lý...</span>
                </span>
              ) : (
                <span>Đăng nhập Email</span>
              )}
            </button>
          </form>

          {pendingEmail && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 mb-3">
                Tài khoản <strong>{pendingEmail}</strong> chưa được kích hoạt. Vui lòng kiểm tra email hoặc gửi lại email kích hoạt.
              </p>
              <button
                onClick={handleResendActivation}
                disabled={resending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
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
