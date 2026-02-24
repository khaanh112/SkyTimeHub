import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Waves, Mail, ArrowRight, Cloud, Send } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600 relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Waves */}
        <div className="absolute bottom-0 left-0 right-0 opacity-20">
          <svg className="w-full h-64" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="rgba(255,255,255,0.3)" d="M0,96L48,112C96,128,192,160,288,165.3C384,171,480,149,576,154.7C672,160,768,192,864,197.3C960,203,1056,181,1152,154.7C1248,128,1344,96,1392,80L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 right-0 opacity-10">
          <svg className="w-full h-72" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="rgba(255,255,255,0.5)" d="M0,224L48,213.3C96,203,192,181,288,176C384,171,480,181,576,192C672,203,768,213,864,208C960,203,1056,181,1152,165.3C1248,149,1344,139,1392,133.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
        
        {/* Floating Clouds */}
        <div className="absolute top-20 left-10 opacity-30 animate-float">
          <Cloud className="w-16 h-16 text-white" />
        </div>
        <div className="absolute top-40 right-20 opacity-20 animate-float-delayed">
          <Cloud className="w-20 h-20 text-white" />
        </div>
        <div className="absolute bottom-40 left-1/4 opacity-25 animate-float-slow">
          <Cloud className="w-24 h-24 text-white" />
        </div>
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Logo & Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-white/30 rounded-full blur-2xl"></div>
            <div className="relative bg-gradient-to-br from-white to-sky-50 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
              <Waves className="w-16 h-16 text-cyan-600" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg tracking-tight">
            SKY CORPORATION
          </h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-px w-12 bg-white/50"></div>
            <p className="text-sky-50 text-lg font-medium tracking-wide">SkyTimeHub</p>
            <div className="h-px w-12 bg-white/50"></div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 text-center mb-8">
            Chào mừng trở lại
          </h2>

          <div className="space-y-5">
            {/* Email Login Form */}
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Địa chỉ Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500 transition-colors group-focus-within:text-cyan-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@skycompany.com"
                    disabled={loading}
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 placeholder:text-gray-400"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">
                  Không cần mật khẩu - dành cho môi trường test
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full group relative flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-600 hover:via-sky-600 hover:to-blue-700 text-white font-semibold rounded-2xl transition-all duration-300 shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập ngay</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Pending account - resend activation email */}
            {pendingEmail && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="text-sm text-amber-800 mb-3">
                  Tài khoản <strong>{pendingEmail}</strong> chưa được kích hoạt. Vui lòng kiểm tra email hoặc gửi lại email kích hoạt.
                </p>
                <button
                  onClick={handleResendActivation}
                  disabled={resending}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">hoặc tiếp tục với</span>
              </div>
            </div>

            {/* Zoho Login Button */}
            <button
              onClick={handleZohoLogin}
              disabled={loading}
              className="w-full group flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-2xl transition-all duration-300 shadow-lg shadow-orange-500/40 hover:shadow-orange-500/60 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>Đăng nhập với Zoho</span>
            </button>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-5 mt-6 border border-cyan-100">
              <h3 className="text-sm font-bold text-cyan-800 mb-3 flex items-center gap-2">
                <span className="text-lg">💡</span>
                <span>Hướng dẫn đăng nhập</span>
              </h3>
              <ul className="text-xs text-cyan-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-0.5">•</span>
                  <span>Nhập email bất kỳ để đăng nhập nhanh</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-0.5">•</span>
                  <span>Tài khoản được tạo tự động nếu chưa tồn tại</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-0.5">•</span>
                  <span>Sử dụng Zoho OAuth cho xác thực chính thức</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/90 text-sm font-medium drop-shadow">
            © 2026 Sky Corporation. All rights reserved.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-25px); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 8s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
