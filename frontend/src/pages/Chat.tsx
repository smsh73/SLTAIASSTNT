import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ChatInput from '../components/ChatInput';
import PromptOverlay from '../components/PromptOverlay';
import DocumentPreview from '../components/DocumentPreview';
import LogMonitor from '../components/LogMonitor';
import ConversationHistory from '../components/ConversationHistory';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { Message } from '../types/message';
import { useStreamChat } from '../hooks/useStreamChat';

export default function Chat() {
  const { conversationId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { token } = useAuthStore();
  const { streamChat, isStreaming } = useStreamChat();

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
    setStreamingMessage('');

    // 스트리밍 모드로 전송
    const assistantMessageId = Date.now() + 1;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    await streamChat(
      message,
      conversationId || null,
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
      (fullResponse: string) => {
        setStreamingMessage('');
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullResponse }
              : msg
          )
        );
        setLoading(false);
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

