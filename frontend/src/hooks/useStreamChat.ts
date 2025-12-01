import { useState, useCallback } from 'react';
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
      onError?: (error: string) => void,
      onAgentStart?: (provider: string, providerName: string, phase?: string, round?: number) => void,
      onAgentComplete?: (agentMessage: AgentMessage) => void,
      onPhaseChange?: (phase: string) => void
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
        
        console.log('=== useStreamChat v6: Sending request ===', requestBody);
        
        console.log('=== Fetching SSE... ===');
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
        console.log('=== Fetch response received ===', response.status, response.ok);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        console.log('=== Reader created ===', !!reader);
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let buffer = '';
        let fullResponse = '';
        let currentAgentContent = '';
        let currentProvider = '';
        let currentProviderName = '';
        let currentPhase = '';
        let currentRound = 0;

        console.log('=== SSE Reader started ===');
        
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('=== SSE Reader done ===');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('=== SSE Chunk received ===', chunk.substring(0, 100));
          buffer += chunk;
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          let newConversationId: number | undefined;
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamMessage = JSON.parse(line.substring(6));
                console.log('=== SSE Data parsed ===', data.type);

                if (data.type === 'conversationId' && data.conversationId) {
                  newConversationId = data.conversationId;
                } else if (data.type === 'phase' && data.phase) {
                  currentPhase = data.phase;
                  onPhaseChange?.(data.phase);
                } else if (data.type === 'agent_start') {
                  currentProvider = data.provider || '';
                  currentProviderName = data.providerName || '';
                  currentAgentContent = '';
                  currentRound = data.round || 0;
                  onAgentStart?.(currentProvider, currentProviderName, data.phase, data.round);
                } else if (data.type === 'chunk' && data.content) {
                  fullResponse += data.content;
                  currentAgentContent += data.content;
                  onChunk?.(data.content);
                } else if (data.type === 'agent_complete') {
                  const agentMessage: AgentMessage = {
                    provider: currentProvider,
                    providerName: currentProviderName,
                    content: currentAgentContent,
                    phase: currentPhase,
                    round: currentRound,
                  };
                  onAgentComplete?.(agentMessage);
                  currentAgentContent = '';
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
