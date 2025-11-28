import OpenAI from 'openai';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';
import { getPrismaClient } from '../../utils/database.js';
import { getCircuitBreaker } from './circuitBreaker.js';

const prisma = getPrismaClient();
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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function chatWithOpenAI(messages: ChatMessage[]): Promise<string | null> {
  const circuitBreaker = getCircuitBreaker('openai');
  
  return await circuitBreaker.execute(
    async () => {
      try {
        const openai = await getOpenAIClient();
        if (!openai) {
          throw new Error('OpenAI client not initialized');
        }

        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: messages.map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
          temperature: 0.7,
          max_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content || null;

        logger.success('OpenAI chat completed', {
          tokens: response.usage?.total_tokens,
          logType: 'success',
        });

        return content;
      } catch (error) {
        logger.error('OpenAI chat error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          logType: 'error',
        });
        throw error;
      }
    },
    async () => {
      logger.warning('OpenAI circuit breaker open, returning null', {
        logType: 'warning',
      });
      return null;
    }
  );
}

