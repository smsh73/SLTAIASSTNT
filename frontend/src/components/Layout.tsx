import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Chat from '../pages/Chat';
import ApiKeys from '../pages/admin/ApiKeys';
import Users from '../pages/admin/Users';
import Logs from '../pages/admin/Logs';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const location = useLocation();
  const { user } = useAuthStore();
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/chat/:conversationId?" element={<Chat />} />
            {user?.role === 'admin' && isAdminPage && (
              <>
                <Route path="/admin/api-keys" element={<ApiKeys />} />
                <Route path="/admin/users" element={<Users />} />
                <Route path="/admin/logs" element={<Logs />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </div>
  );
}
