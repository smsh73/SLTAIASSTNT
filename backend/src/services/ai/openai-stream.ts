import OpenAI from 'openai';
import { getOpenAIClient } from './openai.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'OpenAIStream',
});

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export async function chatWithOpenAIStream(
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const client = await getOpenAIClient();
    if (!client) {
      callbacks.onError(new Error('OpenAI client not initialized'));
      return;
    }

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        callbacks.onChunk(content);
      }
    }

    callbacks.onComplete();

    logger.success('OpenAI stream completed', {
      logType: 'success',
    });
  } catch (error) {
    logger.error('OpenAI stream error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

