import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface Conversation {
  id: number;
  title: string;
  topic: string;
  updatedAt: string;
}

export default function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const fetchedRef = useRef(false);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(
        '/api/conversations',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = response.data?.conversations || [];
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch conversations', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchConversations();
    }
  }, [token, fetchConversations]);
  
  useEffect(() => {
    const handleRefresh = () => {
      fetchConversations();
    };
    
    window.addEventListener('refreshConversations', handleRefresh);
    return () => {
      window.removeEventListener('refreshConversations', handleRefresh);
    };
  }, [fetchConversations]);

  if (loading) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-2">
      {conversations.length === 0 ? (
        <div className="text-gray-500 text-sm">대화 이력이 없습니다.</div>
      ) : (
        conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => navigate(`/chat/${conv.id}`)}
            className="w-full text-left p-3 rounded hover:bg-gray-200 transition-colors text-sm"
          >
            <div className="font-medium text-gray-800 truncate">
              {conv.title || conv.topic || '제목 없음'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(conv.updatedAt).toLocaleDateString('ko-KR')}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

