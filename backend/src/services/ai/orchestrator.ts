import { routeAndChat, ChatMessage, RoutingResult } from './router.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'Orchestrator',
});

export interface OrchestrationOptions {
  useMultipleProviders?: boolean;
  fallbackProviders?: string[];
}

export async function orchestrateAI(
  messages: ChatMessage[],
  userPrompt: string,
  options?: OrchestrationOptions
): Promise<string | null> {
  try {
    // 기본 라우팅 및 채팅
    const result = await routeAndChat(messages, userPrompt);

    if (!result) {
      // 폴백 프로바이더 시도
      if (options?.fallbackProviders && options.fallbackProviders.length > 0) {
        logger.info('Trying fallback providers', {
          fallbacks: options.fallbackProviders,
          logType: 'info',
        });

        for (const provider of options.fallbackProviders) {
          let response: string | null = null;

          switch (provider) {
            case 'openai':
              response = await chatWithOpenAI(messages);
              break;
            case 'claude':
              response = await chatWithClaude(messages);
              break;
            case 'gemini':
              response = await chatWithGemini(messages);
              break;
            case 'perplexity':
              response = await chatWithPerplexity(messages);
              break;
            case 'luxia':
              response = await chatWithLuxia(messages);
              break;
          }

          if (response) {
            logger.success('Fallback provider succeeded', {
              provider,
              logType: 'success',
            });
            return response;
          }
        }
      }

      logger.error('All providers failed', {
        logType: 'error',
      });
      return null;
    }

    // 다중 프로바이더 사용 옵션 (향후 구현)
    if (options?.useMultipleProviders) {
      // 여러 프로바이더의 응답을 결합하는 로직
      // 현재는 단일 응답 반환
    }

    return result.response;
  } catch (error) {
    logger.error('Orchestration error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

// 임시 import (실제로는 router에서 가져와야 함)
import { chatWithOpenAI } from './openai.js';
import { chatWithClaude } from './claude.js';
import { chatWithGemini } from './gemini.js';
import { chatWithPerplexity } from './perplexity.js';
import { chatWithLuxia } from './luxia.js';

