import { ChatMessage } from './router.js';
import { createLogger } from '../../utils/logger.js';
import { getCircuitBreaker } from './circuitBreaker.js';
import { chatWithOpenAIStream } from './openai-stream.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'OrchestratorStream',
});

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export async function orchestrateAIStream(
  messages: ChatMessage[],
  userPrompt: string,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const circuitBreaker = getCircuitBreaker('openai');
    
    await circuitBreaker.execute(
      async () => {
        let fullResponse = '';

        await chatWithOpenAIStream(messages, {
          onChunk: (chunk: string) => {
            fullResponse += chunk;
            callbacks.onChunk(chunk);
          },
          onComplete: () => {
            callbacks.onComplete(fullResponse);
          },
          onError: (error: Error) => {
            callbacks.onError(error);
          },
        });
      },
      async () => {
        callbacks.onError(new Error('Circuit breaker is open'));
      }
    );
  } catch (error) {
    logger.error('Stream orchestration error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

