import { routeAndChat, ChatMessage, RoutingResult } from './router.js';
import { createLogger } from '../../utils/logger.js';
import { getCircuitBreaker } from './circuitBreaker.js';
import { getCache, setCache, CACHE_PREFIXES } from '../../utils/cache.js';

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
    // 캐시 키 생성 (프롬프트 기반)
    const cacheKey = `orchestrate:${Buffer.from(userPrompt).toString('base64').substring(0, 50)}`;
    
    // 캐시 확인
    const cached = await getCache<string>(cacheKey, {
      prefix: CACHE_PREFIXES.API_RESPONSE,
      ttl: 3600, // 1시간
    });
    
    if (cached) {
      logger.info('AI response retrieved from cache', {
        logType: 'success',
      });
      return cached;
    }

    // 기본 라우팅 및 채팅
    const result = await routeAndChat(messages, userPrompt);

    if (!result) {
      // 폴백 프로바이더 시도 (자동 폴백)
      const allProviders: Array<'openai' | 'claude' | 'gemini' | 'perplexity' | 'luxia'> = 
        options?.fallbackProviders || ['openai', 'claude', 'gemini', 'perplexity', 'luxia'];
      
      logger.info('Trying fallback providers', {
        fallbacks: allProviders,
        logType: 'info',
      });

      for (const provider of allProviders) {
        try {
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
        } catch (providerError) {
          logger.warning('Fallback provider failed', {
            provider,
            error: providerError instanceof Error ? providerError.message : 'Unknown error',
            logType: 'warning',
          });
          // 다음 프로바이더 시도
          continue;
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

    // 응답 캐싱
    if (result.response) {
      await setCache(cacheKey, result.response, {
        prefix: CACHE_PREFIXES.API_RESPONSE,
        ttl: 3600, // 1시간
      });
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

import { chatWithOpenAI } from './openai.js';
import { chatWithClaude } from './claude.js';
import { chatWithGemini } from './gemini.js';
import { chatWithPerplexity } from './perplexity.js';
import { chatWithLuxia } from './luxia.js';

