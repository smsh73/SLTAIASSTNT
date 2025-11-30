import { useState } from 'react';
import ConversationList from './ConversationList';
import { useAuthStore } from '../store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewConversation = () => {
    if (location.pathname === '/chat' || location.pathname.startsWith('/chat/')) {
      window.dispatchEvent(new CustomEvent('newConversation'));
    } else {
      navigate('/chat');
    }
  };

  const handleToggleLogMonitor = () => {
    window.dispatchEvent(new CustomEvent('toggleLogMonitor'));
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-72'
      } bg-gray-50 border-r border-gray-200 flex flex-col`}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-gray-800">대화 목록</h2>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={handleNewConversation}
            className="w-full mb-4 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
          >
            + 새 대화
          </button>
          <ConversationList />
        </div>
      )}

      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleToggleLogMonitor}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            작업 로그
          </button>
        </div>
      )}

      {!isCollapsed && user?.role === 'admin' && (
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">관리자 메뉴</p>
          <div className="space-y-1">
            <button
              onClick={() => navigate('/admin/users')}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded"
            >
              사용자 관리
            </button>
            <button
              onClick={() => navigate('/admin/api-keys')}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded"
            >
              API 키 관리
            </button>
            <button
              onClick={() => navigate('/admin/logs')}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded"
            >
              로그 관리
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

