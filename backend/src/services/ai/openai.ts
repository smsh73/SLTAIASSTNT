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

let cachedClient: OpenAI | null = null;
let cachedKeyId: number | null = null;

export async function getOpenAIClient(): Promise<OpenAI | null> {
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

    if (cachedClient && cachedKeyId === apiKey.id) {
      return cachedClient;
    }

    const decryptedApiKey = decrypt(apiKey.apiKey);

    cachedClient = new OpenAI({
      apiKey: decryptedApiKey,
    });
    cachedKeyId = apiKey.id;

    logger.info('OpenAI client initialized', { logType: 'info' });

    return cachedClient;
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
          model: 'gpt-4.1',
          messages: messages.map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          })),
          temperature: 0.7,
          max_tokens: 4096,
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

