import { analyzeIntent, Intent } from './intentAnalyzer.js';
import { selectProvider } from './weightManager.js';
import { chatWithOpenAI } from './openai.js';
import { chatWithClaude } from './claude.js';
import { chatWithGemini } from './gemini.js';
import { chatWithPerplexity } from './perplexity.js';
import { chatWithLuxia } from './luxia.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'Router',
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RoutingResult {
  provider: string;
  response: string;
  intent: Intent;
}

export async function routeAndChat(
  messages: ChatMessage[],
  userPrompt: string
): Promise<RoutingResult | null> {
  try {
    // 의도 분석
    const intent = analyzeIntent(userPrompt);

    // 프로바이더 선택
    const selectedProvider = await selectProvider(intent.preferredProvider);

    if (!selectedProvider) {
      logger.error('No provider available', {
        logType: 'error',
      });
      return null;
    }

    logger.info('Routing to provider', {
      provider: selectedProvider,
      intent: intent.type,
      confidence: intent.confidence,
      logType: 'info',
    });

    // 선택된 프로바이더로 채팅
    let response: string | null = null;

    switch (selectedProvider) {
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

    if (!response) {
      logger.error('Failed to get response from provider', {
        provider: selectedProvider,
        logType: 'error',
      });
      return null;
    }

    return {
      provider: selectedProvider,
      response,
      intent,
    };
  } catch (error) {
    logger.error('Routing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

