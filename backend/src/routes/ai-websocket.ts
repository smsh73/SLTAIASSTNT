import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getPrismaClient } from '../utils/database.js';
import { getIO } from '../utils/socket.js';
import { chatWithOpenAIStream, StreamCallbacks } from '../services/ai/openai-stream.js';
import { chatWithClaudeStream } from '../services/ai/claude.js';
import { chatWithGeminiStream } from '../services/ai/gemini.js';
import { chatWithPerplexityStream } from '../services/ai/perplexity.js';
import { streamLuxia } from '../services/ai/luxia.js';

const router = express.Router();
const prisma = getPrismaClient();

interface A2ARequest {
  message: string;
  conversationId?: number;
  sessionId: string;
}

const PROVIDERS = ['openai', 'claude', 'gemini', 'perplexity'] as const;
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI GPT-4.1',
  claude: 'Claude Sonnet 4.5',
  gemini: 'Google Gemini 2.5',
  perplexity: 'Perplexity Sonar Pro',
  luxia: 'Luxia AI',
};

function getKoreanDate(): string {
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = koreaTime.getFullYear();
  const month = koreaTime.getMonth() + 1;
  const day = koreaTime.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[koreaTime.getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday}요일)`;
}

function buildSystemPrompt(providerName: string, phase: string, round: number): string {
  const koreanDate = getKoreanDate();
  
  if (phase === 'collaboration') {
    return `오늘은 ${koreanDate}입니다. 당신은 ${providerName}입니다. 여러 AI 에이전트가 협력하여 사용자의 질문에 답변하고 있습니다. 
이것은 협력 라운드 ${round}입니다. 다른 AI들의 관점을 존중하면서 당신만의 고유한 인사이트와 관점을 제공해 주세요.
이전 AI들의 응답을 참고하되, 새로운 정보나 다른 각도에서의 분석을 추가해 주세요.
응답 마지막에 '*${providerName}*'으로 서명해 주세요.`;
  } else if (phase === 'debate') {
    return `오늘은 ${koreanDate}입니다. 당신은 ${providerName}입니다. 여러 AI 에이전트가 토론을 통해 답변을 발전시키고 있습니다.
이것은 토론 라운드 ${round}입니다. 이전 라운드에서 나온 의견들을 비판적으로 검토하고, 부족한 점을 보완하거나 다른 관점을 제시해 주세요.
건설적인 토론을 통해 더 나은 결론을 도출할 수 있도록 기여해 주세요.
응답 마지막에 '*${providerName}*'으로 서명해 주세요.`;
  } else {
    return `오늘은 ${koreanDate}입니다. 당신은 ${providerName}입니다. 
다양한 AI 에이전트들의 협력과 토론 내용을 종합하여 최종 답변을 작성해 주세요.

다음 형식으로 답변해 주세요:

## 📋 AI별 핵심 인사이트
각 AI의 주요 기여점을 요약

## 🎯 종합 결론
모든 관점을 통합한 최종 답변

## 💡 핵심 포인트
가장 중요한 결론 3-5가지

응답 마지막에 '*${providerName}*'으로 서명해 주세요.`;
  }
}

async function streamProviderResponse(
  provider: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  sessionId: string,
  phase: string,
  round: number
): Promise<string> {
  const providerName = PROVIDER_NAMES[provider];
  const systemPrompt = buildSystemPrompt(providerName, phase, round);
  
  const messagesWithSystem = [
    { role: 'system' as const, content: systemPrompt },
    ...messages,
  ];

  let fullResponse = '';
  let hasError = false;
  
  const io = getIO();
  const callbacks: StreamCallbacks = {
    onChunk: (chunk: string) => {
      fullResponse += chunk;
      io.to(`a2a_${sessionId}`).emit('a2a_chunk', {
        provider,
        providerName,
        phase,
        round,
        chunk,
        timestamp: Date.now(),
      });
    },
    onComplete: () => {},
    onError: (error: Error) => {
      hasError = true;
      logger.error(`A2A WebSocket: ${provider} error`, {
        screenName: 'AI',
        callerFunction: 'streamProviderResponse',
        error: error.message,
        logType: 'error',
      });
      const errorMessage = `[${providerName}: 응답 생성 실패 - ${error.message}]`;
      fullResponse = errorMessage;
      io.to(`a2a_${sessionId}`).emit('a2a_chunk', {
        provider,
        providerName,
        phase,
        round,
        chunk: errorMessage,
        timestamp: Date.now(),
      });
    },
  };

  try {
    switch (provider) {
      case 'openai':
        await chatWithOpenAIStream(messagesWithSystem, callbacks);
        break;
      case 'claude':
        await chatWithClaudeStream(messagesWithSystem, callbacks);
        break;
      case 'gemini':
        await chatWithGeminiStream(messagesWithSystem, callbacks);
        break;
      case 'perplexity':
        await chatWithPerplexityStream(messagesWithSystem, callbacks);
        break;
      case 'luxia':
        const stream = await streamLuxia(messagesWithSystem);
        if (stream) {
          for await (const chunk of stream as AsyncIterable<Buffer>) {
            const text = chunk.toString();
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.choices?.[0]?.delta?.content || '';
                  if (content) {
                    fullResponse += content;
                    io.to(`a2a_${sessionId}`).emit('a2a_chunk', {
                      provider,
                      providerName,
                      phase,
                      round,
                      chunk: content,
                      timestamp: Date.now(),
                    });
                  }
                } catch {}
              }
            }
          }
        }
        break;
    }
  } catch (error) {
    logger.error(`A2A WebSocket: ${provider} error`, {
      screenName: 'AI',
      callerFunction: 'streamProviderResponse',
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    fullResponse = `[${providerName} 응답 실패]`;
  }

  return fullResponse;
}

router.post('/a2a/start', authenticateToken, async (req, res) => {
  const { message, conversationId, sessionId } = req.body as A2ARequest;
  const userId = (req as any).user?.id;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  logger.info('A2A WebSocket session starting', {
    screenName: 'AI',
    callerFunction: 'a2a.start',
    sessionId,
    userId,
    logType: 'info',
  });

  res.json({ status: 'started', sessionId });

  processA2A(message, sessionId, userId, conversationId).catch((error) => {
    logger.error('A2A processing error', {
      screenName: 'AI',
      callerFunction: 'processA2A',
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    getIO().to(`a2a_${sessionId}`).emit('a2a_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });
});

async function processA2A(
  userMessage: string,
  sessionId: string,
  userId: number,
  conversationId?: number
): Promise<void> {
  const io = getIO();
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; provider?: string }> = [];
  let totalResponse = '';
  let actualConversationId = conversationId;

  if (!actualConversationId) {
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
        status: 'active',
      },
    });
    actualConversationId = conversation.id;

    io.to(`a2a_${sessionId}`).emit('a2a_conversation', {
      conversationId: actualConversationId,
    });
  }

  await prisma.message.create({
    data: {
      conversationId: actualConversationId,
      userId,
      role: 'user',
      content: userMessage,
    },
  });

  const userMessages = [{ role: 'user' as const, content: userMessage }];

  io.to(`a2a_${sessionId}`).emit('a2a_phase', { phase: 'collaboration' });

  for (let round = 1; round <= 2; round++) {
    for (const provider of PROVIDERS) {
      io.to(`a2a_${sessionId}`).emit('a2a_agent_start', {
        provider,
        providerName: PROVIDER_NAMES[provider],
        phase: 'collaboration',
        round,
      });

      const contextMessages = [
        ...userMessages,
        ...conversationHistory.map((h) => ({
          role: 'assistant' as const,
          content: `[${h.provider}]: ${h.content}`,
        })),
      ];

      const response = await streamProviderResponse(
        provider,
        contextMessages,
        sessionId,
        'collaboration',
        round
      );

      conversationHistory.push({
        role: 'assistant',
        content: response,
        provider: PROVIDER_NAMES[provider],
      });

      totalResponse += `\n\n### ${PROVIDER_NAMES[provider]} (협력 라운드 ${round})\n${response}`;

      io.to(`a2a_${sessionId}`).emit('a2a_agent_complete', {
        provider,
        providerName: PROVIDER_NAMES[provider],
        phase: 'collaboration',
        round,
        content: response,
      });

      logger.info(`A2A: ${provider} collaboration round ${round} completed`, {
        screenName: 'AI',
        callerFunction: 'processA2A',
        responseLength: response.length,
        logType: 'info',
      });
    }
  }

  io.to(`a2a_${sessionId}`).emit('a2a_phase', { phase: 'debate' });

  for (let round = 1; round <= 2; round++) {
    for (const provider of PROVIDERS) {
      io.to(`a2a_${sessionId}`).emit('a2a_agent_start', {
        provider,
        providerName: PROVIDER_NAMES[provider],
        phase: 'debate',
        round,
      });

      const contextMessages = [
        ...userMessages,
        ...conversationHistory.map((h) => ({
          role: 'assistant' as const,
          content: `[${h.provider}]: ${h.content}`,
        })),
      ];

      const response = await streamProviderResponse(
        provider,
        contextMessages,
        sessionId,
        'debate',
        round
      );

      conversationHistory.push({
        role: 'assistant',
        content: response,
        provider: PROVIDER_NAMES[provider],
      });

      totalResponse += `\n\n### ${PROVIDER_NAMES[provider]} (토론 라운드 ${round})\n${response}`;

      io.to(`a2a_${sessionId}`).emit('a2a_agent_complete', {
        provider,
        providerName: PROVIDER_NAMES[provider],
        phase: 'debate',
        round,
        content: response,
      });

      logger.info(`A2A: ${provider} debate round ${round} completed`, {
        screenName: 'AI',
        callerFunction: 'processA2A',
        responseLength: response.length,
        logType: 'info',
      });
    }
  }

  io.to(`a2a_${sessionId}`).emit('a2a_phase', { phase: 'synthesis' });
  io.to(`a2a_${sessionId}`).emit('a2a_agent_start', {
    provider: 'luxia',
    providerName: PROVIDER_NAMES.luxia,
    phase: 'synthesis',
    round: 1,
  });

  const synthesisMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    {
      role: 'user',
      content: `사용자 질문: ${userMessage}\n\n다음은 여러 AI 에이전트들의 협력과 토론 내용입니다:\n\n${conversationHistory
        .map((h) => `[${h.provider}]: ${h.content}`)
        .join('\n\n')}\n\n위 내용을 종합하여 최종 답변을 작성해 주세요.`,
    },
  ];

  let synthesisResponse = '';
  try {
    synthesisResponse = await streamProviderResponse(
      'luxia',
      synthesisMessages,
      sessionId,
      'synthesis',
      1
    );
  } catch (error) {
    synthesisResponse = await streamProviderResponse(
      'claude',
      synthesisMessages,
      sessionId,
      'synthesis',
      1
    );
  }

  totalResponse += `\n\n## 🌟 Luxia AI 최종 종합\n${synthesisResponse}`;

  io.to(`a2a_${sessionId}`).emit('a2a_agent_complete', {
    provider: 'luxia',
    providerName: PROVIDER_NAMES.luxia,
    phase: 'synthesis',
    round: 1,
    content: synthesisResponse,
  });

  await prisma.message.create({
    data: {
      conversationId: actualConversationId,
      userId,
      role: 'assistant',
      content: totalResponse,
      provider: 'a2a',
    },
  });

  await prisma.conversation.update({
    where: { id: actualConversationId },
    data: { updatedAt: new Date() },
  });

  io.to(`a2a_${sessionId}`).emit('a2a_complete', {
    conversationId: actualConversationId,
    totalLength: totalResponse.length,
  });

  logger.info('A2A WebSocket session completed', {
    screenName: 'AI',
    callerFunction: 'processA2A',
    sessionId,
    conversationId: actualConversationId,
    totalLength: totalResponse.length,
    logType: 'success',
  });
}

export default router;
