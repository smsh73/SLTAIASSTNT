import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';

const prisma = new PrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'OpenAIClient',
});

let client: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI | null> {
  if (client) return client;

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        provider: 'openai',
        isActive: true,
      },
      orderBy: {
        weight: 'desc',
      },
    });

    if (!apiKey) {
      logger.warning('OpenAI API key not found', {
        logType: 'warning',
      });
      return null;
    }

    // API 키 복호화
    const decryptedApiKey = decrypt(apiKey.apiKey);

    client = new OpenAI({
      apiKey: decryptedApiKey,
    });

    return client;
  } catch (error) {
    logger.error('Failed to initialize OpenAI client', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

export async function chatWithOpenAI(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number }
): Promise<string | null> {
  try {
    const openai = await getOpenAIClient();
    if (!openai) return null;

    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4-turbo-preview',
      messages: messages as any,
      temperature: options?.temperature || 0.7,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    logger.error('OpenAI chat error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

