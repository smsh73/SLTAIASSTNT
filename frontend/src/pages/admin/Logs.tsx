import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

interface Log {
  id: number;
  logType: string;
  message: string;
  callerFunction?: string;
  screenName?: string;
  screenUrl?: string;
  backendApiUrl?: string;
  errorCode?: string;
  createdAt: string;
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

export default function Logs() {
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const { token } = useAuthStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    keyword: '',
    logType: '',
    startDate: '',
    endDate: '',
    screenName: '',
  });

  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentCommand, setCurrentCommand] = useState('');
  const [output, setOutput] = useState<string[]>([
    '\x1b[32m╔════════════════════════════════════════════════════════════════╗\x1b[0m',
    '\x1b[32m║\x1b[0m  \x1b[36m███████╗ █████╗ ██╗  ████████╗██╗     ██╗   ██╗██╗  ██╗\x1b[0m     \x1b[32m║\x1b[0m',
    '\x1b[32m║\x1b[0m  \x1b[36m██╔════╝██╔══██╗██║  ╚══██╔══╝██║     ██║   ██║╚██╗██╔╝\x1b[0m     \x1b[32m║\x1b[0m',
    '\x1b[32m║\x1b[0m  \x1b[36m███████╗███████║██║     ██║   ██║     ██║   ██║ ╚███╔╝\x1b[0m      \x1b[32m║\x1b[0m',
    '\x1b[32m║\x1b[0m  \x1b[36m╚════██║██╔══██║██║     ██║   ██║     ██║   ██║ ██╔██╗\x1b[0m      \x1b[32m║\x1b[0m',
    '\x1b[32m║\x1b[0m  \x1b[36m███████║██║  ██║███████╗██║   ███████╗╚██████╔╝██╔╝ ██╗\x1b[0m     \x1b[32m║\x1b[0m',
    '\x1b[32m║\x1b[0m  \x1b[36m╚══════╝╚═╝  ╚═╝╚══════╝╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝\x1b[0m     \x1b[32m║\x1b[0m',
    '\x1b[32m║\x1b[0m                                                              \x1b[32m║\x1b[0m',
    '\x1b[32m║\x1b[0m  \x1b[33mLog Management System v1.0\x1b[0m                                 \x1b[32m║\x1b[0m',
    '\x1b[32m╚════════════════════════════════════════════════════════════════╝\x1b[0m',
    '',
    '\x1b[33mType "help" for available commands.\x1b[0m',
    '',
  ]);

  const limit = 50;

  const formatAnsi = (text: string): JSX.Element[] => {
    const parts = text.split(/(\x1b\[[0-9;]*m)/);
    let currentColor = '';
    
    return parts.map((part, index) => {
      if (part.match(/\x1b\[([0-9;]*)m/)) {
        const code = part.match(/\x1b\[([0-9;]*)m/)?.[1];
        if (code === '0') currentColor = '';
        else if (code === '31') currentColor = 'text-red-400';
        else if (code === '32') currentColor = 'text-green-400';
        else if (code === '33') currentColor = 'text-yellow-400';
        else if (code === '34') currentColor = 'text-blue-400';
        else if (code === '35') currentColor = 'text-purple-400';
        else if (code === '36') currentColor = 'text-cyan-400';
        else if (code === '37') currentColor = 'text-gray-300';
        else if (code === '90') currentColor = 'text-gray-500';
        return <span key={index}></span>;
      }
      return <span key={index} className={currentColor}>{part}</span>;
    });
  };

  const addOutput = useCallback((lines: string | string[]) => {
    const newLines = Array.isArray(lines) ? lines : [lines];
    setOutput(prev => [...prev, ...newLines]);
  }, []);

  const fetchLogs = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const params: any = { limit, offset: newOffset };
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.logType) params.logType = filters.logType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.screenName) params.screenName = filters.screenName;

      const response = await axios.get('/api/admin/logs', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      
      setTotal(response.data.total);
      setOffset(newOffset);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch logs', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  const fetchPromptStats = useCallback(async () => {
    try {
      const params: any = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await axios.get('/api/admin/logs/stats/prompts', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch prompt stats', error);
      return null;
    }
  }, [token, filters.startDate, filters.endDate]);

  const fetchLogTypeStats = useCallback(async () => {
    try {
      const params: any = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await axios.get('/api/admin/logs/stats/types', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch log type stats', error);
      return null;
    }
  }, [token, filters.startDate, filters.endDate]);

  const getLogTypeColor = (logType: string): string => {
    switch (logType) {
      case 'error': return '\x1b[31m';
      case 'warning': return '\x1b[33m';
      case 'success': return '\x1b[32m';
      case 'info': return '\x1b[36m';
      case 'debug': return '\x1b[90m';
      default: return '\x1b[37m';
    }
  };

  const formatLogEntry = (log: Log): string[] => {
    const timestamp = new Date(log.createdAt).toLocaleString('ko-KR');
    const typeColor = getLogTypeColor(log.logType);
    const userName = log.user?.name || log.user?.email || 'system';
    
    return [
      `${typeColor}[${log.logType.toUpperCase().padEnd(7)}]\x1b[0m \x1b[90m${timestamp}\x1b[0m`,
      `  \x1b[36mScreen:\x1b[0m ${log.screenName || '-'} \x1b[36mFunction:\x1b[0m ${log.callerFunction || '-'}`,
      `  \x1b[36mUser:\x1b[0m ${userName} \x1b[36mAPI:\x1b[0m ${log.backendApiUrl || '-'}`,
      `  \x1b[37mMessage:\x1b[0m ${log.message || '-'}`,
      log.errorCode ? `  \x1b[31mError Code:\x1b[0m ${log.errorCode}` : '',
      '\x1b[90m────────────────────────────────────────────────────────────────\x1b[0m',
    ].filter(Boolean);
  };

  const showHelp = () => {
    addOutput([
      '',
      '\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m',
      '\x1b[36m║\x1b[0m                    \x1b[33mAVAILABLE COMMANDS\x1b[0m                       \x1b[36m║\x1b[0m',
      '\x1b[36m╠══════════════════════════════════════════════════════════════╣\x1b[0m',
      '\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mlogs\x1b[0m                    - 최신 로그 조회                  \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mlogs -n <count>\x1b[0m         - 지정된 개수만큼 로그 조회       \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mlogs --next\x1b[0m             - 다음 페이지                     \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mlogs --prev\x1b[0m             - 이전 페이지                     \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32msearch <keyword>\x1b[0m        - 키워드로 로그 검색              \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mfilter type <type>\x1b[0m      - 로그 타입 필터                  \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m      (error/warning/success/info/debug)                      \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mfilter screen <name>\x1b[0m    - 화면명 필터                     \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mfilter date <start> <end>\x1b[0m - 기간 필터 (YYYY-MM-DD)       \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mfilter clear\x1b[0m            - 모든 필터 초기화               \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mstats\x1b[0m                   - 로그 통계 조회                 \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mprompts\x1b[0m                 - 프롬프트 통계 조회             \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mclear\x1b[0m                   - 화면 지우기                    \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[32mhelp\x1b[0m                    - 도움말 표시                    \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m',
      '\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m',
      '',
    ]);
  };

  const showStats = async () => {
    addOutput(['\x1b[33mLoading statistics...\x1b[0m']);
    const data = await fetchLogTypeStats();
    if (!data) {
      addOutput(['\x1b[31mFailed to load statistics.\x1b[0m']);
      return;
    }

    const lines = [
      '',
      '\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m',
      '\x1b[36m║\x1b[0m                    \x1b[33mLOG STATISTICS\x1b[0m                           \x1b[36m║\x1b[0m',
      '\x1b[36m╠══════════════════════════════════════════════════════════════╣\x1b[0m',
      '\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m',
      '\x1b[36m║\x1b[0m  \x1b[33mLog Types:\x1b[0m                                                \x1b[36m║\x1b[0m',
    ];

    data.typeStats.forEach((stat: { type: string; count: number }) => {
      const color = getLogTypeColor(stat.type);
      const bar = '█'.repeat(Math.min(Math.ceil(stat.count / 10), 30));
      lines.push(`\x1b[36m║\x1b[0m    ${color}${stat.type.padEnd(10)}\x1b[0m ${bar} \x1b[90m(${stat.count})\x1b[0m`);
    });

    lines.push('\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m');
    lines.push('\x1b[36m║\x1b[0m  \x1b[33mTop Screens:\x1b[0m                                              \x1b[36m║\x1b[0m');

    data.screenStats.slice(0, 5).forEach((stat: { screen: string; count: number }) => {
      lines.push(`\x1b[36m║\x1b[0m    \x1b[32m${(stat.screen || 'Unknown').padEnd(20)}\x1b[0m \x1b[90m${stat.count} logs\x1b[0m`);
    });

    lines.push('\x1b[36m║\x1b[0m                                                              \x1b[36m║\x1b[0m');
    lines.push('\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m');
    lines.push('');

    addOutput(lines);
  };

  const showPromptStats = async () => {
    addOutput(['\x1b[33mLoading prompt statistics...\x1b[0m']);
    const data = await fetchPromptStats();
    if (!data) {
      addOutput(['\x1b[31mFailed to load prompt statistics.\x1b[0m']);
      return;
    }

    const lines = [
      '',
      '\x1b[35m╔══════════════════════════════════════════════════════════════╗\x1b[0m',
      '\x1b[35m║\x1b[0m                   \x1b[33mPROMPT STATISTICS\x1b[0m                         \x1b[35m║\x1b[0m',
      '\x1b[35m╠══════════════════════════════════════════════════════════════╣\x1b[0m',
      '\x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m',
      '\x1b[35m║\x1b[0m  \x1b[33mOverall Statistics:\x1b[0m                                       \x1b[35m║\x1b[0m',
      `\x1b[35m║\x1b[0m    \x1b[36mTotal Messages:\x1b[0m     ${data.totalMessages.toString().padStart(10)}                  \x1b[35m║\x1b[0m`,
      `\x1b[35m║\x1b[0m    \x1b[32mUser Prompts:\x1b[0m       ${data.userMessages.toString().padStart(10)}                  \x1b[35m║\x1b[0m`,
      `\x1b[35m║\x1b[0m    \x1b[34mAI Responses:\x1b[0m       ${data.assistantMessages.toString().padStart(10)}                  \x1b[35m║\x1b[0m`,
      '\x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m',
      '\x1b[35m║\x1b[0m  \x1b[33mAI Provider Usage:\x1b[0m                                        \x1b[35m║\x1b[0m',
    ];

    const totalProviderCalls = data.providerStats.reduce((sum: number, p: { count: number }) => sum + p.count, 0);
    data.providerStats.forEach((stat: { provider: string; count: number }) => {
      const percentage = totalProviderCalls > 0 ? Math.round((stat.count / totalProviderCalls) * 100) : 0;
      const bar = '█'.repeat(Math.min(Math.ceil(percentage / 3), 25));
      lines.push(`\x1b[35m║\x1b[0m    \x1b[36m${stat.provider.padEnd(12)}\x1b[0m ${bar} \x1b[90m${percentage}% (${stat.count})\x1b[0m`);
    });

    lines.push('\x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m');
    lines.push('\x1b[35m║\x1b[0m  \x1b[33mTop Users:\x1b[0m                                                \x1b[35m║\x1b[0m');

    data.topUsers.slice(0, 5).forEach((user: { name: string; count: number }, i: number) => {
      lines.push(`\x1b[35m║\x1b[0m    \x1b[90m${(i + 1).toString().padStart(2)}.\x1b[0m \x1b[32m${user.name.substring(0, 20).padEnd(20)}\x1b[0m \x1b[90m${user.count} prompts\x1b[0m`);
    });

    if (data.dailyStats.length > 0) {
      lines.push('\x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m');
      lines.push('\x1b[35m║\x1b[0m  \x1b[33mDaily Activity (Last 7 days):\x1b[0m                             \x1b[35m║\x1b[0m');

      data.dailyStats.slice(0, 7).forEach((day: { date: string; user_count: string; assistant_count: string }) => {
        const date = new Date(day.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
        const userCount = parseInt(day.user_count);
        const bar = '▓'.repeat(Math.min(userCount, 20));
        lines.push(`\x1b[35m║\x1b[0m    \x1b[90m${date}\x1b[0m \x1b[32m${bar}\x1b[0m \x1b[90m${userCount} prompts\x1b[0m`);
      });
    }

    lines.push('\x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m');
    lines.push('\x1b[35m╚══════════════════════════════════════════════════════════════╝\x1b[0m');
    lines.push('');

    addOutput(lines);
  };

  const executeCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    const parts = trimmedCmd.split(/\s+/);
    const command = parts[0];

    addOutput(`\x1b[32msaltlux@admin\x1b[0m:\x1b[34m~/logs\x1b[0m$ ${cmd}`);

    if (cmd.trim()) {
      setCommandHistory(prev => [...prev, cmd]);
      setHistoryIndex(-1);
    }

    switch (command) {
      case 'help':
        showHelp();
        break;

      case 'clear':
        setOutput([]);
        break;

      case 'logs':
        try {
          if (parts[1] === '--next') {
            const newOffset = offset + limit;
            if (newOffset < total) {
              addOutput(['\x1b[33mLoading next page...\x1b[0m']);
              const data = await fetchLogs(newOffset);
              if (data) {
                addOutput([
                  `\x1b[32mShowing ${newOffset + 1}-${Math.min(newOffset + limit, total)} of ${total} logs\x1b[0m`,
                  '',
                ]);
                data.logs.forEach((log: Log) => addOutput(formatLogEntry(log)));
              } else {
                addOutput(['\x1b[31mFailed to fetch logs.\x1b[0m']);
              }
            } else {
              addOutput(['\x1b[33mNo more logs to show.\x1b[0m']);
            }
          } else if (parts[1] === '--prev') {
            const newOffset = Math.max(0, offset - limit);
            if (offset > 0) {
              addOutput(['\x1b[33mLoading previous page...\x1b[0m']);
              const data = await fetchLogs(newOffset);
              if (data) {
                addOutput([
                  `\x1b[32mShowing ${newOffset + 1}-${Math.min(newOffset + limit, total)} of ${total} logs\x1b[0m`,
                  '',
                ]);
                data.logs.forEach((log: Log) => addOutput(formatLogEntry(log)));
              } else {
                addOutput(['\x1b[31mFailed to fetch logs.\x1b[0m']);
              }
            } else {
              addOutput(['\x1b[33mAlready at the first page.\x1b[0m']);
            }
          } else if (parts[1] === '-n' && parts[2]) {
            const count = parseInt(parts[2]);
            if (isNaN(count) || count < 1) {
              addOutput(['\x1b[31mUsage: logs -n <count> (count must be a positive number)\x1b[0m']);
            } else {
              addOutput([`\x1b[33mLoading ${count} logs...\x1b[0m`]);
              const params: any = { limit: Math.min(count, 200), offset: 0 };
              if (filters.keyword) params.keyword = filters.keyword;
              if (filters.logType) params.logType = filters.logType;
              if (filters.startDate) params.startDate = filters.startDate;
              if (filters.endDate) params.endDate = filters.endDate;
              if (filters.screenName) params.screenName = filters.screenName;

              const response = await axios.get('/api/admin/logs', {
                headers: { Authorization: `Bearer ${token}` },
                params,
              });
              
              const data = response.data;
              setTotal(data.total);
              setOffset(0);
              
              addOutput([
                `\x1b[32mShowing 1-${Math.min(count, data.total)} of ${data.total} logs\x1b[0m`,
                '',
              ]);
              data.logs.forEach((log: Log) => addOutput(formatLogEntry(log)));
            }
          } else {
            addOutput(['\x1b[33mLoading logs...\x1b[0m']);
            const data = await fetchLogs(0);
            if (data) {
              addOutput([
                `\x1b[32mShowing 1-${Math.min(limit, data.total)} of ${data.total} logs\x1b[0m`,
                '',
              ]);
              data.logs.forEach((log: Log) => addOutput(formatLogEntry(log)));
            } else {
              addOutput(['\x1b[31mFailed to fetch logs.\x1b[0m']);
            }
          }
        } catch (error) {
          addOutput(['\x1b[31mError: Failed to fetch logs. Please try again.\x1b[0m']);
          console.error('Logs fetch error:', error);
        }
        break;

      case 'search':
        const keyword = parts.slice(1).join(' ');
        if (!keyword) {
          addOutput(['\x1b[31mUsage: search <keyword>\x1b[0m']);
        } else {
          try {
            setFilters(prev => ({ ...prev, keyword }));
            addOutput([`\x1b[33mSearching for "${keyword}"...\x1b[0m`]);
            const params: any = { limit, offset: 0, keyword };
            if (filters.logType) params.logType = filters.logType;
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (filters.screenName) params.screenName = filters.screenName;
            
            const response = await axios.get('/api/admin/logs', {
              headers: { Authorization: `Bearer ${token}` },
              params,
            });
            
            const data = response.data;
            setTotal(data.total);
            setOffset(0);
            
            addOutput([
              `\x1b[32mFound ${data.total} matching logs\x1b[0m`,
              '',
            ]);
            data.logs.forEach((log: Log) => addOutput(formatLogEntry(log)));
          } catch (error) {
            addOutput(['\x1b[31mError: Search failed. Please try again.\x1b[0m']);
            console.error('Search error:', error);
          }
        }
        break;

      case 'filter':
        if (parts[1] === 'type') {
          const logType = parts[2];
          if (!logType) {
            addOutput(['\x1b[31mUsage: filter type <error|warning|success|info|debug>\x1b[0m']);
          } else {
            setFilters(prev => ({ ...prev, logType }));
            addOutput([`\x1b[32mFilter set: logType = ${logType}\x1b[0m`]);
          }
        } else if (parts[1] === 'screen') {
          const screenName = parts.slice(2).join(' ');
          if (!screenName) {
            addOutput(['\x1b[31mUsage: filter screen <name>\x1b[0m']);
          } else {
            setFilters(prev => ({ ...prev, screenName }));
            addOutput([`\x1b[32mFilter set: screenName = ${screenName}\x1b[0m`]);
          }
        } else if (parts[1] === 'date') {
          const startDate = parts[2];
          const endDate = parts[3];
          if (!startDate) {
            addOutput(['\x1b[31mUsage: filter date <start-date> [end-date]\x1b[0m']);
            addOutput(['\x1b[90mDate format: YYYY-MM-DD\x1b[0m']);
          } else {
            setFilters(prev => ({ 
              ...prev, 
              startDate, 
              endDate: endDate || startDate 
            }));
            addOutput([`\x1b[32mFilter set: date = ${startDate} to ${endDate || startDate}\x1b[0m`]);
          }
        } else if (parts[1] === 'clear') {
          setFilters({
            keyword: '',
            logType: '',
            startDate: '',
            endDate: '',
            screenName: '',
          });
          addOutput(['\x1b[32mAll filters cleared.\x1b[0m']);
        } else {
          addOutput([
            '\x1b[31mUnknown filter command.\x1b[0m',
            '\x1b[90mAvailable: filter type|screen|date|clear\x1b[0m',
          ]);
        }
        break;

      case 'stats':
        await showStats();
        break;

      case 'prompts':
        await showPromptStats();
        break;

      default:
        if (cmd.trim()) {
          addOutput([
            `\x1b[31mCommand not found: ${command}\x1b[0m`,
            '\x1b[90mType "help" for available commands.\x1b[0m',
          ]);
        }
    }

    setCurrentCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const commands = ['help', 'logs', 'search', 'filter', 'stats', 'prompts', 'clear'];
      const matching = commands.filter(c => c.startsWith(currentCommand.toLowerCase()));
      if (matching.length === 1) {
        setCurrentCommand(matching[0]);
      }
    }
  };

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const currentFiltersDisplay = () => {
    const active = [];
    if (filters.keyword) active.push(`keyword="${filters.keyword}"`);
    if (filters.logType) active.push(`type=${filters.logType}`);
    if (filters.startDate) active.push(`from=${filters.startDate}`);
    if (filters.endDate) active.push(`to=${filters.endDate}`);
    if (filters.screenName) active.push(`screen="${filters.screenName}"`);
    return active.length > 0 ? active.join(' ') : 'none';
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-4 text-gray-400 text-sm font-mono">saltlux-admin — logs — 80x24</span>
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Active filters: {currentFiltersDisplay()}
        </div>
      </div>

      <div
        ref={terminalRef}
        onClick={handleTerminalClick}
        className="flex-1 bg-black rounded-lg p-4 font-mono text-sm overflow-y-auto cursor-text border border-gray-700"
        style={{ 
          minHeight: '500px',
          fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
        }}
      >
        {output.map((line, index) => (
          <div key={index} className="text-gray-100 whitespace-pre leading-6">
            {formatAnsi(line)}
          </div>
        ))}
        
        <div className="flex items-center text-gray-100 mt-2">
          <span className="text-green-400">saltlux@admin</span>
          <span className="text-gray-100">:</span>
          <span className="text-blue-400">~/logs</span>
          <span className="text-gray-100">$ </span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-gray-100 caret-green-400"
            autoFocus
            spellCheck={false}
          />
          {loading && <span className="text-yellow-400 ml-2 animate-pulse">●</span>}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 font-mono flex justify-between">
        <span>Press Tab for autocomplete | Arrow Up/Down for history</span>
        <span>Total logs: {total} | Page: {Math.floor(offset / limit) + 1}/{Math.ceil(total / limit) || 1}</span>
      </div>
    </div>
  );
}
