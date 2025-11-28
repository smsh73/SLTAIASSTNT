import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'ClaudeClient',
});

let client: Anthropic | null = null;

export async function getClaudeClient(): Promise<Anthropic | null> {
  if (client) return client;

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        provider: 'claude',
        isActive: true,
      },
      orderBy: {
        weight: 'desc',
      },
    });

    if (!apiKey) {
      logger.warning('Claude API key not found', {
        logType: 'warning',
      });
      return null;
    }

    // API 키 복호화
    const decryptedApiKey = decrypt(apiKey.apiKey);

    client = new Anthropic({
      apiKey: decryptedApiKey,
    });

    return client;
  } catch (error) {
    logger.error('Failed to initialize Claude client', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

export async function chatWithClaude(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number }
): Promise<string | null> {
  try {
    const claude = await getClaudeClient();
    if (!claude) return null;

    // Claude는 시스템 메시지를 별도로 처리
    const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })) as any;

    const response = await (claude as any).messages.create({
      model: options?.model || 'claude-3-opus-20240229',
      max_tokens: 4096,
      temperature: options?.temperature || 0.7,
      system: systemMessage || undefined,
      messages: conversationMessages,
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : null;
  } catch (error) {
    logger.error('Claude chat error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

