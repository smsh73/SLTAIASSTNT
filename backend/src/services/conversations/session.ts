import { createLogger } from '../../utils/logger.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
const logger = createLogger({
  screenName: 'Conversations',
  callerFunction: 'SessionManager',
});

export interface ConversationSession {
  id: number;
  userId: number;
  title: string;
  topic: string;
  messages: Array<{
    role: string;
    content: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_CONTEXT_MESSAGES = 20; // 컨텍스트에 포함할 최대 메시지 수

export async function createSession(
  userId: number,
  title?: string,
  topic?: string
): Promise<ConversationSession> {
  try {
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: title || '새 대화',
        topic: topic || 'general',
      },
    });

    logger.success('Conversation session created', {
      userId,
      conversationId: conversation.id,
      logType: 'success',
    });

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title || '새 대화',
      topic: conversation.topic || 'general',
      messages: [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  } catch (error) {
    logger.error('Failed to create conversation session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      logType: 'error',
    });
    throw error;
  }
}

export async function getSession(
  conversationId: number,
  userId: number
): Promise<ConversationSession | null> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title || '새 대화',
      topic: conversation.topic || 'general',
      messages: conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  } catch (error) {
    logger.error('Failed to get conversation session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      userId,
      logType: 'error',
    });
    return null;
  }
}

export async function listSessions(
  userId: number,
  limit: number = 50
): Promise<ConversationSession[]> {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      userId: conv.userId,
      title: conv.title || '새 대화',
      topic: conv.topic || 'general',
      messages: conv.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));
  } catch (error) {
    logger.error('Failed to list conversation sessions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      logType: 'error',
    });
    return [];
  }
}

export async function getContextMessages(
  conversationId: number,
  maxMessages: number = MAX_CONTEXT_MESSAGES
): Promise<Array<{ role: string; content: string }>> {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: maxMessages,
    });

    // 최신 메시지부터 오래된 순서로 반환
    return messages
      .reverse()
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  } catch (error) {
    logger.error('Failed to get context messages', {
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      logType: 'error',
    });
    return [];
  }
}

