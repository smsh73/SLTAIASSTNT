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

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export async function chatWithPerplexityStream(
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
  options?: { model?: string }
): Promise<void> {
  const modelName = options?.model || 'sonar-pro';
  
  logger.info('Perplexity stream starting', {
    model: modelName,
    messageCount: messages.length,
    logType: 'info',
  });
  
  try {
    const apiKey = await getPerplexityApiKey();
    if (!apiKey) {
      callbacks.onError(new Error('Perplexity API key not available'));
      return;
    }

    const filteredMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .map((m) => ({
        role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: modelName,
        messages: filteredMessages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        timeout: 120000,
        responseType: 'stream',
      }
    );

    let fullResponse = '';
    let buffer = '';

    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              callbacks.onChunk(content);
            }
          } catch {
          }
        }
      }
    });

    await new Promise<void>((resolve, reject) => {
      response.data.on('end', () => {
        logger.info('Perplexity stream completed', {
          responseLength: fullResponse.length,
          logType: 'success',
        });
        callbacks.onComplete(fullResponse);
        resolve();
      });
      response.data.on('error', (error: Error) => {
        logger.error('Perplexity stream error', {
          error: error.message,
          logType: 'error',
        });
        reject(error);
      });
    });
  } catch (error: any) {
    logger.error('Perplexity stream error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      logType: 'error',
    });
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
