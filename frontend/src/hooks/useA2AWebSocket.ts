import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

interface AgentMessage {
  provider: string;
  providerName: string;
  content: string;
  phase: string;
  round: number;
}

interface A2AState {
  isConnected: boolean;
  isProcessing: boolean;
  currentPhase: string;
  currentAgent: {
    provider: string;
    providerName: string;
    phase: string;
    round: number;
  } | null;
  error: string | null;
}

export function useA2AWebSocket() {
  const [state, setState] = useState<A2AState>({
    isConnected: false,
    isProcessing: false,
    currentPhase: '',
    currentAgent: null,
    error: null,
  });
  
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();
  
  const onAgentStart = useRef<((provider: string, providerName: string, phase: string, round: number) => void) | null>(null);
  const onAgentChunk = useRef<((provider: string, chunk: string) => void) | null>(null);
  const onAgentComplete = useRef<((agent: AgentMessage) => void) | null>(null);
  const onPhaseChange = useRef<((phase: string) => void) | null>(null);
  const onConversationCreated = useRef<((conversationId: number) => void) | null>(null);
  const onComplete = useRef<((conversationId: number) => void) | null>(null);
  const onError = useRef<((error: string) => void) | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const backendUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001'
      : `${window.location.protocol}//${window.location.hostname}:3001`;

    socketRef.current = io(backendUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: {
        token: token,
      },
    });

    socketRef.current.on('connect', () => {
      console.log('=== A2A WebSocket connected ===', socketRef.current?.id);
      setState((prev) => ({ ...prev, isConnected: true, error: null }));
    });

    socketRef.current.on('disconnect', () => {
      console.log('=== A2A WebSocket disconnected ===');
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    socketRef.current.on('a2a_phase', (data: { phase: string }) => {
      console.log('=== A2A Phase:', data.phase);
      setState((prev) => ({ ...prev, currentPhase: data.phase }));
      onPhaseChange.current?.(data.phase);
    });

    socketRef.current.on('a2a_agent_start', (data: {
      provider: string;
      providerName: string;
      phase: string;
      round: number;
    }) => {
      console.log('=== A2A Agent Start:', data.provider, data.phase, data.round);
      setState((prev) => ({
        ...prev,
        currentAgent: data,
      }));
      onAgentStart.current?.(data.provider, data.providerName, data.phase, data.round);
    });

    socketRef.current.on('a2a_chunk', (data: {
      provider: string;
      providerName: string;
      phase: string;
      round: number;
      chunk: string;
      timestamp: number;
    }) => {
      onAgentChunk.current?.(data.provider, data.chunk);
    });

    socketRef.current.on('a2a_agent_complete', (data: {
      provider: string;
      providerName: string;
      phase: string;
      round: number;
      content: string;
    }) => {
      console.log('=== A2A Agent Complete:', data.provider, 'length:', data.content.length);
      setState((prev) => ({ ...prev, currentAgent: null }));
      onAgentComplete.current?.({
        provider: data.provider,
        providerName: data.providerName,
        content: data.content,
        phase: data.phase,
        round: data.round,
      });
    });

    socketRef.current.on('a2a_conversation', (data: { conversationId: number }) => {
      console.log('=== A2A Conversation created:', data.conversationId);
      onConversationCreated.current?.(data.conversationId);
    });

    socketRef.current.on('a2a_complete', (data: { conversationId: number; totalLength: number }) => {
      console.log('=== A2A Complete, total length:', data.totalLength);
      setState((prev) => ({ ...prev, isProcessing: false, currentPhase: '', currentAgent: null }));
      onComplete.current?.(data.conversationId);
    });

    socketRef.current.on('a2a_error', (data: { error: string }) => {
      console.error('=== A2A Error:', data.error);
      setState((prev) => ({ ...prev, isProcessing: false, error: data.error }));
      onError.current?.(data.error);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('=== A2A WebSocket connect error:', error.message);
      setState((prev) => ({ ...prev, error: error.message }));
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState((prev) => ({ ...prev, isConnected: false }));
    }
  }, []);

  const startA2A = useCallback(async (
    message: string,
    conversationId: string | null,
    callbacks: {
      onAgentStart?: (provider: string, providerName: string, phase: string, round: number) => void;
      onAgentChunk?: (provider: string, chunk: string) => void;
      onAgentComplete?: (agent: AgentMessage) => void;
      onPhaseChange?: (phase: string) => void;
      onConversationCreated?: (conversationId: number) => void;
      onComplete?: (conversationId: number) => void;
      onError?: (error: string) => void;
    }
  ) => {
    onAgentStart.current = callbacks.onAgentStart || null;
    onAgentChunk.current = callbacks.onAgentChunk || null;
    onAgentComplete.current = callbacks.onAgentComplete || null;
    onPhaseChange.current = callbacks.onPhaseChange || null;
    onConversationCreated.current = callbacks.onConversationCreated || null;
    onComplete.current = callbacks.onComplete || null;
    onError.current = callbacks.onError || null;

    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const ensureConnectedAndJoined = async (): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          connect();
        }

        const checkConnection = () => {
          if (socketRef.current?.connected) {
            console.log('=== Socket connected, joining A2A room ===');
            socketRef.current.emit('start_a2a', { sessionId }, (ack: { joined: boolean }) => {
              console.log('=== A2A room join acknowledged:', ack);
              resolve(true);
            });
            
            const joinedHandler = (data: { sessionId: string }) => {
              if (data.sessionId === sessionId) {
                console.log('=== A2A room joined via event ===');
                socketRef.current?.off('a2a_joined', joinedHandler);
                resolve(true);
              }
            };
            socketRef.current.on('a2a_joined', joinedHandler);
            
            setTimeout(() => {
              socketRef.current?.off('a2a_joined', joinedHandler);
              resolve(true);
            }, 1000);
          } else {
            setTimeout(checkConnection, 100);
          }
        };

        if (socketRef.current?.connected) {
          checkConnection();
        } else {
          socketRef.current?.once('connect', checkConnection);
          setTimeout(() => resolve(false), 5000);
        }
      });
    };

    setState((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      const joined = await ensureConnectedAndJoined();
      if (!joined) {
        throw new Error('Failed to connect to WebSocket');
      }

      console.log('=== Sending A2A start request ===', { sessionId });

      const response = await fetch('/api/ai/a2a/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          conversationId: conversationId ? parseInt(conversationId) : null,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('=== A2A session started:', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({ ...prev, isProcessing: false, error: errorMessage }));
      onError.current?.(errorMessage);
    }
  }, [token, connect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startA2A,
  };
}
