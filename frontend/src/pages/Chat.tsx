import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatInput from '../components/ChatInput';
import PromptOverlay from '../components/PromptOverlay';
import DocumentPreview from '../components/DocumentPreview';
import LogMonitor from '../components/LogMonitor';
import ConversationHistory from '../components/ConversationHistory';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { Message } from '../types/message';
import { useStreamChat } from '../hooks/useStreamChat';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { token } = useAuthStore();
  const { streamChat } = useStreamChat();

  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [chatMode, setChatMode] = useState<'normal' | 'mix' | 'a2a'>('normal');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleSend = async (message: string) => {
    if (!message.trim()) return;

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
      id: Date.now(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setCurrentInput('');
    setStreamingMessage('');
    setUploadedFiles([]);

    const assistantMessageId = Date.now() + 1;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    console.log('=== Sending message ===', {
      chatMode,
      selectedProvider,
      conversationId,
    });
    
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
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <h2 className="text-2xl font-semibold mb-4">
                AI 어시스턴트와 대화를 시작하세요
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
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
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
              show={showOverlay}
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
            />
          </div>
        </div>
      </div>

      <DocumentPreview />
      <LogMonitor />
    </div>
  );
}
