import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Layout from './components/Layout';
import ApiKeys from './pages/admin/ApiKeys';
import Users from './pages/admin/Users';
import Logs from './pages/admin/Logs';

function App() {
  const { token, user } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
      <Route
        path="/*"
        element={token ? <Layout /> : <Navigate to="/login" />}
      />
      {user?.role === 'admin' && (
        <>
          <Route path="/admin/api-keys" element={<Layout><ApiKeys /></Layout>} />
          <Route path="/admin/users" element={<Layout><Users /></Layout>} />
          <Route path="/admin/logs" element={<Layout><Logs /></Layout>} />
        </>
      )}
    </Routes>
  );
}

export default App;

