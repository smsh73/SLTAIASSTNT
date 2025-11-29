import axios from 'axios';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
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
  const modelName = options?.model || 'sonar-pro';
  
  logger.info('Perplexity chat request starting', {
    model: modelName,
    messageCount: messages.length,
    logType: 'info',
  });
  
  try {
    const apiKey = await getPerplexityApiKey();
    if (!apiKey) {
      logger.warning('Perplexity API key not available', {
        logType: 'warning',
      });
      return null;
    }

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: modelName,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 4096,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices[0]?.message?.content || null;
    
    logger.info('Perplexity chat response received', {
      hasContent: !!content,
      contentLength: content?.length || 0,
      logType: 'success',
    });
    
    return content;
  } catch (error: any) {
    logger.error('Perplexity chat error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      responseData: JSON.stringify(error?.response?.data || {}),
      logType: 'error',
    });
    return null;
  }
}
