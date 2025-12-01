import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

type ChatMode = 'normal' | 'mix' | 'a2a';

interface StreamMessage {
  type: 'chunk' | 'complete' | 'error' | 'conversationId' | 'agent_start' | 'agent_complete' | 'phase';
  content?: string;
  message?: string;
  conversationId?: number;
  provider?: string;
  providerName?: string;
  phase?: string;
  round?: number;
}

interface AgentMessage {
  provider: string;
  providerName: string;
  content: string;
  phase?: string;
  round?: number;
}

interface ChunkQueueItem {
  type: 'chunk' | 'agent_start' | 'agent_complete' | 'phase' | 'complete';
  content?: string;
  provider?: string;
  providerName?: string;
  phase?: string;
  round?: number;
  conversationId?: number;
}

export function useStreamChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const { token } = useAuthStore();
  const chunkQueueRef = useRef<ChunkQueueItem[]>([]);
  const processingRef = useRef(false);
  const callbacksRef = useRef<{
    onChunk?: (chunk: string) => void;
    onComplete?: (fullResponse: string, newConversationId?: number) => void;
    onAgentStart?: (provider: string, providerName: string, phase?: string, round?: number) => void;
    onAgentComplete?: (agentMessage: AgentMessage) => void;
    onPhaseChange?: (phase: string) => void;
  }>({});

  const processQueue = useCallback(() => {
    if (processingRef.current || chunkQueueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;

    const processNextItem = () => {
      if (chunkQueueRef.current.length === 0) {
        processingRef.current = false;
        return;
      }

      const item = chunkQueueRef.current.shift()!;

      if (item.type === 'chunk' && item.content) {
        callbacksRef.current.onChunk?.(item.content);
        setTimeout(processNextItem, 15);
      } else if (item.type === 'agent_start') {
        callbacksRef.current.onAgentStart?.(
          item.provider || '',
          item.providerName || '',
          item.phase,
          item.round
        );
        setTimeout(processNextItem, 50);
      } else if (item.type === 'agent_complete') {
        callbacksRef.current.onAgentComplete?.({
          provider: item.provider || '',
          providerName: item.providerName || '',
          content: '',
          phase: item.phase,
          round: item.round,
        });
        setTimeout(processNextItem, 100);
      } else if (item.type === 'phase') {
        callbacksRef.current.onPhaseChange?.(item.phase || '');
        setTimeout(processNextItem, 100);
      } else if (item.type === 'complete') {
        callbacksRef.current.onComplete?.(item.content || '', item.conversationId);
        processingRef.current = false;
      } else {
        setTimeout(processNextItem, 10);
      }
    };

    processNextItem();
  }, []);

  const streamChat = useCallback(
    async (
      message: string,
      conversationId: string | null,
      provider?: string,
      chatMode?: ChatMode,
      onChunk?: (chunk: string) => void,
      onComplete?: (fullResponse: string, newConversationId?: number) => void,
      onError?: (error: string) => void,
      onAgentStart?: (provider: string, providerName: string, phase?: string, round?: number) => void,
      onAgentComplete?: (agentMessage: AgentMessage) => void,
      onPhaseChange?: (phase: string) => void
    ) => {
      setIsStreaming(true);
      setStreamError(null);
      chunkQueueRef.current = [];
      processingRef.current = false;

      callbacksRef.current = {
        onChunk,
        onComplete,
        onAgentStart,
        onAgentComplete,
        onPhaseChange,
      };

      try {
        const resolvedChatMode = chatMode || 'normal';
        const requestBody = {
          message,
          conversationId: conversationId || null,
          provider: provider || null,
          chatMode: resolvedChatMode,
          mixOfAgents: resolvedChatMode === 'mix',
        };
        
        console.log('=== useStreamChat v7: Sending request ===', requestBody);
        
        const response = await fetch(
          '/api/ai/chat/stream',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Chat-Mode': resolvedChatMode,
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
        let currentProvider = '';
        let currentProviderName = '';
        let currentPhase = '';
        let currentRound = 0;
        let newConversationId: number | undefined;

        console.log('=== SSE Reader started ===');
        
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('=== SSE Reader done ===');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamMessage = JSON.parse(line.substring(6));

                if (data.type === 'conversationId' && data.conversationId) {
                  newConversationId = data.conversationId;
                } else if (data.type === 'phase' && data.phase) {
                  currentPhase = data.phase;
                  chunkQueueRef.current.push({
                    type: 'phase',
                    phase: data.phase,
                  });
                  processQueue();
                } else if (data.type === 'agent_start') {
                  currentProvider = data.provider || '';
                  currentProviderName = data.providerName || '';
                  currentRound = data.round || 0;
                  chunkQueueRef.current.push({
                    type: 'agent_start',
                    provider: currentProvider,
                    providerName: currentProviderName,
                    phase: data.phase,
                    round: data.round,
                  });
                  processQueue();
                } else if (data.type === 'chunk' && data.content) {
                  fullResponse += data.content;
                  chunkQueueRef.current.push({
                    type: 'chunk',
                    content: data.content,
                  });
                  processQueue();
                } else if (data.type === 'agent_complete') {
                  chunkQueueRef.current.push({
                    type: 'agent_complete',
                    provider: currentProvider,
                    providerName: currentProviderName,
                    phase: currentPhase,
                    round: currentRound,
                  });
                  processQueue();
                } else if (data.type === 'complete' && data.content) {
                  fullResponse = data.content;
                  chunkQueueRef.current.push({
                    type: 'complete',
                    content: fullResponse,
                    conversationId: newConversationId || data.conversationId,
                  });
                  processQueue();
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
    [token, processQueue]
  );

  return {
    streamChat,
    isStreaming,
    streamError,
  };
}
