import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatInput, { ToolMode } from '../components/ChatInput';
import PromptOverlay from '../components/PromptOverlay';
import DocumentPreview from '../components/DocumentPreview';
import LogMonitor from '../components/LogMonitor';
import ConversationHistory from '../components/ConversationHistory';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { Message } from '../types/message';
import { useStreamChat } from '../hooks/useStreamChat';
import { useA2AWebSocket } from '../hooks/useA2AWebSocket';
import { validateAndCorrectStock } from '../utils/stockValidator';
import { searchMKNews, searchMKTV, getComprehensiveAnalysis } from '../services/mkApi';

const sessionBase = Date.now() % 100000000;
let messageIdCounter = 0;
function generateUniqueId(): number {
  messageIdCounter += 1;
  return sessionBase * 10000 + messageIdCounter * 10 + Math.floor(Math.random() * 10);
}

interface AgentMessage {
  provider: string;
  providerName: string;
  content: string;
  phase?: string;
  round?: number;
}

interface AIProvider {
  id: string;
  name: string;
  weight: number;
  isActive: boolean;
}

interface UploadedFile {
  id: number;
  filename: string;
  fileType: string;
  parsedText?: string;
}

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [_streamingMessage, setStreamingMessage] = useState<string>('');
  const [_currentAgentId, setCurrentAgentId] = useState<number | null>(null);
  const [_currentPhase, setCurrentPhase] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAgentIdRef = useRef<number | null>(null);
  const { token } = useAuthStore();
  const { streamChat } = useStreamChat();
  const { startA2A } = useA2AWebSocket();

  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [chatMode, setChatMode] = useState<'normal' | 'mix' | 'a2a'>('normal');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>('none');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingConversationIdRef = useRef<number | null>(null);
  const isA2AInProgressRef = useRef<boolean>(false);
  const skipNextLoadRef = useRef<boolean>(false);
  
  const refreshConversationList = useCallback(() => {
    window.dispatchEvent(new CustomEvent('refreshConversations'));
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setCurrentInput('');
    setStreamingMessage('');
    setUploadedFiles([]);
    setLoading(false);
    setChatMode('normal');
    setSelectedProvider('auto');
  }, []);

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (isA2AInProgressRef.current || skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      resetConversation();
    }
  }, [conversationId, resetConversation]);

  useEffect(() => {
    const handleNewConversation = () => {
      resetConversation();
      navigate('/chat', { replace: true });
    };
    
    window.addEventListener('newConversation', handleNewConversation);
    return () => {
      window.removeEventListener('newConversation', handleNewConversation);
    };
  }, [navigate, resetConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadProviders = async () => {
    try {
      const response = await axios.get('/api/ai/providers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProviders(response.data.providers || []);
    } catch (error) {
      console.error('Failed to load providers', error);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const response = await axios.get(
        `/api/conversations/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessages(response.data.conversation?.messages || []);
    } catch (error) {
      console.error('Failed to load conversation', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);
    if (conversationId) {
      formData.append('conversationId', conversationId);
    }

    try {
      const response = await axios.post('/api/documents/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const doc = response.data.document;
      setUploadedFiles((prev) => [
        ...prev,
        {
          id: doc.id,
          filename: doc.filename,
          fileType: doc.fileType,
          parsedText: doc.parsedText,
        },
      ]);
    } catch (error) {
      console.error('Failed to upload file', error);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUploadedFile = (fileId: number) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleToolModeRequest = async (input: string) => {
    setLoading(true);
    setCurrentInput('');

    try {
      // 종목코드/종목명 검증 및 정정
      const stockInfo = validateAndCorrectStock(input);
      
      if (!stockInfo.isValid) {
        const errorMessage: Message = {
          id: generateUniqueId(),
          role: 'assistant',
          content: '종목코드(6자리 숫자) 또는 종목명(한글)을 입력해주세요.\n예: 005930 또는 삼성전자',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setLoading(false);
        return;
      }

      const stockQuery = stockInfo.stockName || stockInfo.stockCode || input;
      const correctedInfo = stockInfo.corrected;
      
      // 정정된 정보가 있으면 사용자에게 알림
      if (correctedInfo && (correctedInfo.stockCode || correctedInfo.stockName)) {
        const correctionMessage: Message = {
          id: generateUniqueId(),
          role: 'system',
          content: `종목 정보 정정: ${correctedInfo.stockCode ? `종목코드: ${correctedInfo.stockCode}` : ''}${correctedInfo.stockName ? ` 종목명: ${correctedInfo.stockName}` : ''}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, correctionMessage]);
      }

      const userMessage: Message = {
        id: generateUniqueId(),
        role: 'user',
        content: `[${toolMode === 'mk-news' ? 'MK뉴스' : toolMode === 'mk-stock' ? 'MK증권' : '통합 분석'}] ${stockQuery}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // 선택한 모드에 따라 API 호출
      let apiResponse: string = '';
      
      if (toolMode === 'mk-news') {
        const response = await searchMKNews(stockQuery);
        apiResponse = response.answer;
        if (response.sources && response.sources.length > 0) {
          apiResponse += '\n\n[참고 기사]\n';
          response.sources.slice(0, 3).forEach((source, idx) => {
            apiResponse += `${idx + 1}. ${source.article.title}\n   ${source.article.article_url}\n`;
          });
        }
      } else if (toolMode === 'mk-stock') {
        const response = await searchMKTV(stockQuery);
        apiResponse = response.answer;
        if (response.sources && response.sources.length > 0) {
          apiResponse += '\n\n[참고 방송]\n';
          response.sources.slice(0, 3).forEach((source, idx) => {
            apiResponse += `${idx + 1}. ${source.tvSegment.program_title} (${source.tvSegment.broadcast_date})\n`;
          });
        }
      } else if (toolMode === 'comprehensive') {
        const response = await getComprehensiveAnalysis(stockQuery);
        apiResponse = `# ${response.stockName} 종합 분석\n\n`;
        apiResponse += `## 요약\n${response.analysis.executiveSummary}\n\n`;
        apiResponse += `## 회사 개요\n${response.analysis.companyOverview.businessModel}\n\n`;
        apiResponse += `## 재무 분석\n${response.analysis.financialAnalysis.recentFinancials}\n\n`;
        apiResponse += `## 전략 분석\n${response.analysis.strategicAnalysis.businessStrategy}\n\n`;
        apiResponse += `## 결론\n${response.analysis.conclusion}`;
      }

      // API 응답을 메시지로 표시
      const apiResponseMessage: Message = {
        id: generateUniqueId(),
        role: 'assistant',
        content: apiResponse,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, apiResponseMessage]);

      // 도구 모드 초기화
      setToolMode('none');

      // A2A 협력모드 시작
      setChatMode('a2a');
      isA2AInProgressRef.current = true;

      const a2aPrompt = `다음은 ${stockQuery}에 대한 ${toolMode === 'mk-news' ? '뉴스 기사' : toolMode === 'mk-stock' ? '증권TV 방송' : '종합 분석'} 정보입니다. 이 정보를 바탕으로 심층적인 분석과 인사이트를 제공해주세요.\n\n${apiResponse}`;

      await startA2A(a2aPrompt, conversationId || null, {
        onAgentStart: (provider: string, providerName: string, phase: string, round: number) => {
          const newAgentId = generateUniqueId();
          currentAgentIdRef.current = newAgentId;
          setCurrentAgentId(newAgentId);
          
          const phaseLabel = phase === 'collaboration' 
            ? `협력 라운드 ${round}` 
            : phase === 'debate' 
              ? `토론 라운드 ${round}` 
              : phase === 'synthesis' 
                ? '최종 종합' 
                : '';
          
          const newAgentMessage: Message = {
            id: newAgentId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            provider: provider,
            providerName: providerName,
            phase: phaseLabel,
          };
          
          setMessages((prev) => [...prev, newAgentMessage]);
        },
        onAgentChunk: (_provider: string, chunk: string) => {
          const agentId = currentAgentIdRef.current;
          if (agentId) {
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === agentId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
          }
        },
        onAgentComplete: (_agent: AgentMessage) => {
          currentAgentIdRef.current = null;
          setCurrentAgentId(null);
        },
        onPhaseChange: (phase: string) => {
          setCurrentPhase(phase);
          
          const phaseMessage: Message = {
            id: generateUniqueId(),
            role: 'system',
            content: phase === 'collaboration' 
              ? '### 1단계: 협력적 인사이트 공유' 
              : phase === 'debate' 
                ? '### 2단계: 토론 및 보완' 
                : phase === 'synthesis' 
                  ? '### 3단계: 최종 종합' 
                  : phase,
            createdAt: new Date().toISOString(),
          };
          
          setMessages((prev) => [...prev, phaseMessage]);
        },
        onConversationCreated: (newConversationId: number) => {
          if (!conversationId) {
            pendingConversationIdRef.current = newConversationId;
            refreshConversationList();
          }
        },
        onComplete: (_conversationId: number) => {
          isA2AInProgressRef.current = false;
          setStreamingMessage('');
          setLoading(false);
          currentAgentIdRef.current = null;
          setCurrentAgentId(null);
          setCurrentPhase('');
          
          if (pendingConversationIdRef.current) {
            const newId = pendingConversationIdRef.current;
            pendingConversationIdRef.current = null;
            skipNextLoadRef.current = true;
            navigate(`/chat/${newId}`, { replace: true });
          }
        },
        onError: (error: string) => {
          console.error('A2A WebSocket error:', error);
          isA2AInProgressRef.current = false;
          setStreamingMessage('');
          setLoading(false);
          currentAgentIdRef.current = null;
          setCurrentAgentId(null);
        },
      });
    } catch (error) {
      console.error('Tool mode request error:', error);
      const errorMessage: Message = {
        id: generateUniqueId(),
        role: 'assistant',
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setLoading(false);
      setToolMode('none');
    }
  };

  const handleSend = async (message: string) => {
    if (!message.trim()) return;

    // 도구 모드가 선택된 경우 처리
    if (toolMode !== 'none') {
      await handleToolModeRequest(message);
      return;
    }

    let fullMessage = message;
    if (uploadedFiles.length > 0) {
      const fileContext = uploadedFiles
        .filter((f) => f.parsedText)
        .map((f) => `[첨부파일: ${f.filename}]\n${f.parsedText}`)
        .join('\n\n');
      if (fileContext) {
        fullMessage = `${fileContext}\n\n---\n\n${message}`;
      }
    }

    const userMessage: Message = {
      id: generateUniqueId(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setCurrentInput('');
    setStreamingMessage('');
    setUploadedFiles([]);
    setCurrentAgentId(null);
    setCurrentPhase('');
    currentAgentIdRef.current = null;

    console.log('=== Sending message ===', {
      chatMode,
      selectedProvider,
      conversationId,
    });

    if (chatMode === 'a2a') {
      console.log('=== Starting A2A with WebSocket ===');
      isA2AInProgressRef.current = true;
      
      await startA2A(fullMessage, conversationId || null, {
        onAgentStart: (provider: string, providerName: string, phase: string, round: number) => {
          const newAgentId = generateUniqueId();
          currentAgentIdRef.current = newAgentId;
          setCurrentAgentId(newAgentId);
          
          const phaseLabel = phase === 'collaboration' 
            ? `협력 라운드 ${round}` 
            : phase === 'debate' 
              ? `토론 라운드 ${round}` 
              : phase === 'synthesis' 
                ? '최종 종합' 
                : '';
          
          const newAgentMessage: Message = {
            id: newAgentId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            provider: provider,
            providerName: providerName,
            phase: phaseLabel,
          };
          
          setMessages((prev) => [...prev, newAgentMessage]);
        },
        onAgentChunk: (_provider: string, chunk: string) => {
          const agentId = currentAgentIdRef.current;
          if (agentId) {
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === agentId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
          }
        },
        onAgentComplete: (_agent: AgentMessage) => {
          currentAgentIdRef.current = null;
          setCurrentAgentId(null);
        },
        onPhaseChange: (phase: string) => {
          setCurrentPhase(phase);
          
          const phaseMessage: Message = {
            id: generateUniqueId(),
            role: 'system',
            content: phase === 'collaboration' 
              ? '### 1단계: 협력적 인사이트 공유' 
              : phase === 'debate' 
                ? '### 2단계: 토론 및 보완' 
                : phase === 'synthesis' 
                  ? '### 3단계: 최종 종합' 
                  : phase,
            createdAt: new Date().toISOString(),
          };
          
          setMessages((prev) => [...prev, phaseMessage]);
        },
        onConversationCreated: (newConversationId: number) => {
          if (!conversationId) {
            pendingConversationIdRef.current = newConversationId;
            refreshConversationList();
          }
        },
        onComplete: (_conversationId: number) => {
          isA2AInProgressRef.current = false;
          setStreamingMessage('');
          setLoading(false);
          currentAgentIdRef.current = null;
          setCurrentAgentId(null);
          setCurrentPhase('');
          
          if (pendingConversationIdRef.current) {
            const newId = pendingConversationIdRef.current;
            pendingConversationIdRef.current = null;
            skipNextLoadRef.current = true;
            navigate(`/chat/${newId}`, { replace: true });
          }
        },
        onError: (error: string) => {
          console.error('A2A WebSocket error:', error);
          isA2AInProgressRef.current = false;
          setStreamingMessage('');
          setLoading(false);
          currentAgentIdRef.current = null;
          setCurrentAgentId(null);
        },
      });
    } else {
      const assistantMessageId = generateUniqueId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      await streamChat(
        fullMessage,
        conversationId || null,
        selectedProvider !== 'auto' ? selectedProvider : undefined,
        chatMode,
        (chunk: string) => {
          setStreamingMessage((prev) => {
            const newContent = prev + chunk;
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: newContent }
                  : msg
              )
            );
            return newContent;
          });
        },
        (fullResponse: string, newConversationId?: number) => {
          setStreamingMessage('');
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
          setLoading(false);
          
          if (newConversationId && !conversationId) {
            navigate(`/chat/${newConversationId}`, { replace: true });
            refreshConversationList();
          }
        },
        (error: string) => {
          console.error('Stream error:', error);
          setStreamingMessage('');
          setLoading(false);
        }
      );
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <h2 className="text-2xl font-semibold mb-4">
                매경AX와 대화를 시작하세요
              </h2>
              <p className="text-gray-400">
                아래 입력창에 메시지를 입력하거나 프롬프트 예시를 확인하세요
              </p>
            </div>
          ) : (
            <>
              <ConversationHistory messages={messages} />
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    {chatMode === 'a2a' ? (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-gray-600 font-medium">A2A 협력 토론 진행 중...</span>
                        </div>
                        <div className="text-xs text-gray-500 pl-5">
                          <p>OpenAI, Claude, Gemini, Perplexity가 순차적으로 토론합니다.</p>
                          <p className="mt-1">협력(2라운드) → 토론(2라운드) → 최종 종합</p>
                          <p className="mt-1 text-gray-400">약 2-3분 소요될 수 있습니다.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">AI 에이전트:</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={loading}
              >
                <option value="auto">자동 선택</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">대화 모드:</label>
              <select
                value={chatMode}
                onChange={(e) => setChatMode(e.target.value as 'normal' | 'mix' | 'a2a')}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={loading}
              >
                <option value="normal">일반</option>
                <option value="mix">Mix of Agents</option>
                <option value="a2a">A2A 협력 토론</option>
              </select>
            </div>

            <div className="flex-1"></div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".txt,.pdf,.doc,.docx,.md,.csv,.xlsx,.xls,.json"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  업로드 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  파일 첨부
                </>
              )}
            </button>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="max-w-[150px] truncate">{file.filename}</span>
                  <button
                    onClick={() => removeUploadedFile(file.id)}
                    className="text-primary-500 hover:text-primary-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <PromptOverlay
              show={showOverlay && currentInput.trim().length > 0}
              suggestions={suggestions}
              loading={suggestionsLoading}
              onSelect={(suggestion) => {
                setCurrentInput(suggestion);
                setShowOverlay(false);
                setSuggestions([]);
              }}
            />
            <ChatInput
              value={currentInput}
              onChange={(value) => {
                setCurrentInput(value);
                setShowOverlay(value.length > 0);
              }}
              onSend={handleSend}
              onSuggestionsChange={setSuggestions}
              onSuggestionsLoadingChange={setSuggestionsLoading}
              loading={loading}
              toolMode={toolMode}
              onToolModeChange={setToolMode}
            />
          </div>
        </div>
      </div>

      <DocumentPreview />
      <LogMonitor />
    </div>
  );
}
