import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ChatInput from '../components/ChatInput';
import PromptOverlay from '../components/PromptOverlay';
import DocumentPreview from '../components/DocumentPreview';
import LogMonitor from '../components/LogMonitor';
import ConversationHistory from '../components/ConversationHistory';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export default function Chat() {
  const { conversationId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async (id: string) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/conversations/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setConversation(response.data);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load conversation', error);
    }
  };

  const handleSend = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setCurrentInput('');

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ai/chat`,
        {
          message,
          conversationId: conversationId || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.content,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!conversationId && response.data.conversationId) {
        window.history.pushState(
          {},
          '',
          `/chat/${response.data.conversationId}`
        );
      }
    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setLoading(false);
    }
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
        <div className="max-w-4xl mx-auto relative">
          <PromptOverlay
            show={showOverlay}
            suggestions={suggestions}
            onSelect={(suggestion) => {
              setCurrentInput(suggestion);
              setShowOverlay(false);
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
            loading={loading}
          />
        </div>
      </div>

      <DocumentPreview />
      <LogMonitor />
    </div>
  );
}

