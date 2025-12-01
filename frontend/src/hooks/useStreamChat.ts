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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeContent(content: string, onChunk: (chunk: string) => void): Promise<void> {
  const words = content.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    onChunk(word);
    await sleep(8);
  }
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
        
        console.log('=== useStreamChat v9: Immediate display ===', requestBody);
        
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
                  console.log('=== New conversationId:', newConversationId);
                } else if (data.type === 'phase' && data.phase) {
                  currentPhase = data.phase;
                  console.log('=== Phase change:', data.phase);
                  onPhaseChange?.(data.phase);
                } else if (data.type === 'agent_start') {
                  currentProvider = data.provider || '';
                  currentProviderName = data.providerName || '';
                  currentRound = data.round || 0;
                  console.log('=== Agent start:', currentProvider, currentProviderName, data.phase, data.round);
                  onAgentStart?.(currentProvider, currentProviderName, data.phase, data.round);
                } else if (data.type === 'agent_complete' && data.content) {
                  console.log('=== Agent complete with content:', data.provider, 'length:', data.content.length);
                  fullResponse += data.content;
                  
                  if (onChunk) {
                    await typeContent(data.content, onChunk);
                  }
                  
                  onAgentComplete?.({
                    provider: data.provider || currentProvider,
                    providerName: currentProviderName,
                    content: data.content,
                    phase: currentPhase,
                    round: currentRound,
                  });
                } else if (data.type === 'chunk' && data.content) {
                  fullResponse += data.content;
                  onChunk?.(data.content);
                } else if (data.type === 'complete' && data.content) {
                  console.log('=== Stream complete, total length:', data.content.length);
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
