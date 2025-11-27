import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';
import { getContextMessages } from './session.js';

const prisma = new PrismaClient();
const logger = createLogger({
  screenName: 'Conversations',
  callerFunction: 'ContextManager',
});

const MAX_CONTEXT_LENGTH = 8000; // 최대 컨텍스트 길이 (토큰 수 대략)

export interface ContextChunk {
  messages: Array<{ role: string; content: string }>;
  summary?: string;
  startIndex: number;
  endIndex: number;
}

export async function manageContext(
  conversationId: number
): Promise<Array<{ role: string; content: string }>> {
  try {
    const allMessages = await getContextMessages(conversationId, 100);

    // 컨텍스트 길이 계산
    const totalLength = allMessages.reduce(
      (sum, m) => sum + m.content.length,
      0
    );

    // 컨텍스트가 너무 길면 요약 필요
    if (totalLength > MAX_CONTEXT_LENGTH) {
      logger.info('Context too long, creating summary', {
        conversationId,
        totalLength,
        logType: 'info',
      });

      return await createSummarizedContext(conversationId, allMessages);
    }

    return allMessages;
  } catch (error) {
    logger.error('Failed to manage context', {
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      logType: 'error',
    });
    return [];
  }
}

async function createSummarizedContext(
  conversationId: number,
  messages: Array<{ role: string; content: string }>
): Promise<Array<{ role: string; content: string }>> {
  try {
    // 오래된 메시지들을 요약
    const recentMessages = messages.slice(-10); // 최근 10개 메시지
    const oldMessages = messages.slice(0, -10); // 나머지 메시지

    if (oldMessages.length === 0) {
      return recentMessages;
    }

    // 오래된 메시지 요약 생성 (실제로는 AI 사용)
    const oldContext = oldMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    // 요약 생성 (간단한 구현)
    const summary = `[이전 대화 요약]\n${oldContext.substring(0, 1000)}...`;

    return [
      {
        role: 'system',
        content: summary,
      },
      ...recentMessages,
    ];
  } catch (error) {
    logger.error('Failed to create summarized context', {
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      logType: 'error',
    });
    // 실패 시 최근 메시지만 반환
    return messages.slice(-10);
  }
}

export async function saveMessage(
  conversationId: number,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<void> {
  try {
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    // 대화 업데이트 시간 갱신
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    logger.debug('Message saved', {
      conversationId,
      role,
      contentLength: content.length,
      logType: 'success',
    });
  } catch (error) {
    logger.error('Failed to save message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      logType: 'error',
    });
    throw error;
  }
}

