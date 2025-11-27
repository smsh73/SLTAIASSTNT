import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [token]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/conversations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    } finally {
      setLoading(false);
    }
  };

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

