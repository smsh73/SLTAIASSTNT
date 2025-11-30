import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface LogEntry {
  id: number;
  logType: string;
  message: string;
  callerFunction?: string;
  createdAt: string;
}

export default function LogMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { token } = useAuthStore();

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  useEffect(() => {
    window.addEventListener('toggleLogMonitor', handleToggle);
    return () => {
      window.removeEventListener('toggleLogMonitor', handleToggle);
    };
  }, [handleToggle]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, token]);

  const fetchLogs = async () => {
    try {
      const response = await axios.get(
        '/api/logs/recent',
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 50 },
        }
      );
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs', error);
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

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-40 max-h-96 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">작업 로그</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            로그가 없습니다
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded text-xs ${getLogColor(log.logType)}`}
            >
              <div className="font-medium">{log.message}</div>
              {log.callerFunction && (
                <div className="text-gray-500 mt-1">
                  {log.callerFunction}
                </div>
              )}
              <div className="text-gray-400 mt-1">
                {new Date(log.createdAt).toLocaleTimeString('ko-KR')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

