import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Layout from './components/Layout';

function App() {
  const { token } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
      <Route
        path="/*"
        element={token ? <Layout /> : <Navigate to="/login" />}
      />
    </Routes>
  );
}

export default App;
