import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

interface StreamMessage {
  type: 'chunk' | 'complete' | 'error';
  content?: string;
  message?: string;
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
      mixOfAgents?: boolean,
      onChunk?: (chunk: string) => void,
      onComplete?: (fullResponse: string) => void,
      onError?: (error: string) => void
    ) => {
      setIsStreaming(true);
      setStreamError(null);

      try {
        const response = await fetch(
          '/api/ai/chat/stream',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              message,
              conversationId: conversationId || null,
              provider: provider || null,
              mixOfAgents: mixOfAgents || false,
            }),
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

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamMessage = JSON.parse(line.substring(6));

                if (data.type === 'chunk' && data.content) {
                  fullResponse += data.content;
                  onChunk?.(data.content);
                } else if (data.type === 'complete' && data.content) {
                  fullResponse = data.content;
                  onComplete?.(fullResponse);
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
