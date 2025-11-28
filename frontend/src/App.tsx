import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Layout from './components/Layout';

function App() {
  const { token, isHydrated } = useAuthStore();
  const location = useLocation();

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-primary-600 text-lg">로딩 중...</div>
      </div>
    );
  }

  if (location.pathname === '/login') {
    if (token) {
      return <Navigate to="/" replace />;
    }
    return <Login />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/*" element={<Layout />} />
    </Routes>
  );
}

export default App;
