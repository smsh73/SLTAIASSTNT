import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

interface Log {
  id: number;
  logType: string;
  message: string;
  callerFunction?: string;
  screenName?: string;
  createdAt: string;
}

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await axios.get(
        '/api/admin/logs',
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 },
        }
      );
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setLoading(false);
    }
  };

  const getLogColor = (logType: string) => {
    switch (logType) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'success':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return <div className="p-6">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">로그 관리</h1>
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`p-4 rounded-lg ${getLogColor(log.logType)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{log.message}</div>
                {log.callerFunction && (
                  <div className="text-sm mt-1">{log.callerFunction}</div>
                )}
                {log.screenName && (
                  <div className="text-xs mt-1">화면: {log.screenName}</div>
                )}
              </div>
              <div className="text-xs">
                {new Date(log.createdAt).toLocaleString('ko-KR')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

