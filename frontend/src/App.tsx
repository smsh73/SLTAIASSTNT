import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Layout from './components/Layout';

function App() {
  const { token } = useAuthStore();
  const location = useLocation();

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
