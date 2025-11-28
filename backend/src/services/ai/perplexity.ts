import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';

const prisma = new PrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'PerplexityClient',
});

export async function getPerplexityApiKey(): Promise<string | null> {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        provider: 'perplexity',
        isActive: true,
      },
      orderBy: {
        weight: 'desc',
      },
    });

    if (!apiKey) {
      logger.warning('Perplexity API key not found', {
        logType: 'warning',
      });
      return null;
    }

    // API 키 복호화
    return decrypt(apiKey.apiKey);
  } catch (error) {
    logger.error('Failed to get Perplexity API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

export async function chatWithPerplexity(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string }
): Promise<string | null> {
  try {
    const apiKey = await getPerplexityApiKey();
    if (!apiKey) return null;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: options?.model || 'llama-3-sonar-large-32k-online',
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0]?.message?.content || null;
  } catch (error) {
    logger.error('Perplexity chat error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

