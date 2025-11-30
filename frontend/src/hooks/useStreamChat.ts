import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

type ChatMode = 'normal' | 'mix' | 'a2a';

interface StreamMessage {
  type: 'chunk' | 'complete' | 'error' | 'conversationId';
  content?: string;
  message?: string;
  conversationId?: number;
}

export function useStreamChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const { token } = useAuthStore();

  const streamChat = useCallback(
    async (
      message: string,
      conversationId: string | null,
      provider?: string,
      chatMode?: ChatMode,
      onChunk?: (chunk: string) => void,
      onComplete?: (fullResponse: string, newConversationId?: number) => void,
      onError?: (error: string) => void
    ) => {
      setIsStreaming(true);
      setStreamError(null);

      try {
        const resolvedChatMode = chatMode || 'normal';
        const requestBody = {
          message,
          conversationId: conversationId || null,
          provider: provider || null,
          chatMode: resolvedChatMode,
          mixOfAgents: resolvedChatMode === 'mix',
        };
        
        console.log('=== useStreamChat v3: Sending request ===', requestBody);
        
        const response = await fetch(
          '/api/ai/chat/stream',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let buffer = '';
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          let newConversationId: number | undefined;
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamMessage = JSON.parse(line.substring(6));

                if (data.type === 'conversationId' && data.conversationId) {
                  newConversationId = data.conversationId;
                } else if (data.type === 'chunk' && data.content) {
                  fullResponse += data.content;
                  onChunk?.(data.content);
                } else if (data.type === 'complete' && data.content) {
                  fullResponse = data.content;
                  onComplete?.(fullResponse, newConversationId || data.conversationId);
                } else if (data.type === 'error') {
                  const errorMessage = data.message || 'Stream error';
                  setStreamError(errorMessage);
                  onError?.(errorMessage);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setStreamError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsStreaming(false);
      }
    },
    [token]
  );

  return {
    streamChat,
    isStreaming,
    streamError,
  };
}
