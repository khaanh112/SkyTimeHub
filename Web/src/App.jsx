import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context';
import { LoadingSpinner, Layout } from './components';
import {
  LoginPage,
  AuthCallback,
  UsersPage,
  ProfilePage,
  ActivateAccountPage,
  LeaveRequestManagementPage,
  LeaveRequestDetailPage,
  CreateLeaveRequestPage,
  EditLeaveRequestPage,
} from './pages';
import ImportUsersPage from './pages/ImportUsersPage';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route wrapper (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/activate" element={<ActivateAccountPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/import"
        element={
          <ProtectedRoute>
            <ImportUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-requests"
        element={
          <ProtectedRoute>
            <LeaveRequestManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-requests/create"
        element={
          <ProtectedRoute>
            <CreateLeaveRequestPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-requests/:id/edit"
        element={
          <ProtectedRoute>
            <EditLeaveRequestPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-requests/:id"
        element={
          <ProtectedRoute>
            <LeaveRequestDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          toastClassName="rounded-xl"
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
