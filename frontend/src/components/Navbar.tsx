import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 
          onClick={() => navigate('/')}
          className="text-xl font-bold text-primary-700 cursor-pointer hover:text-primary-800 transition-colors"
        >
          매경AX
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        {user?.role === 'admin' && (
          <div className="flex space-x-2">
            <button
              onClick={() => navigate('/admin/api-keys')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              API 키
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              사용자
            </button>
            <button
              onClick={() => navigate('/admin/logs')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              로그
            </button>
          </div>
        )}
        <span className="text-sm text-gray-700">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          로그아웃
        </button>
      </div>
    </nav>
  );
}

