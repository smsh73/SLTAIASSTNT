import { ChatMessage } from './router.js';
import { createLogger } from '../../utils/logger.js';
import { getCircuitBreaker } from './circuitBreaker.js';
import { chatWithOpenAIStream } from './openai-stream.js';
import { chatWithClaude } from './claude.js';
import { chatWithGemini } from './gemini.js';
import { chatWithPerplexity } from './perplexity.js';
import { chatWithLuxia, streamLuxia } from './luxia.js';
import { selectProvider } from './weightManager.js';
import { analyzeIntent } from './intentAnalyzer.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'OrchestratorStream',
});

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export interface StreamOptions {
  preferredProvider?: string;
  mixOfAgents?: boolean;
}

export async function orchestrateAIStream(
  messages: ChatMessage[],
  userPrompt: string,
  callbacks: StreamCallbacks,
  options?: StreamOptions
): Promise<void> {
  try {
    let provider = options?.preferredProvider;
    
    if (!provider) {
      const intent = analyzeIntent(userPrompt);
      provider = await selectProvider(intent.preferredProvider) || 'openai';
    }
    
    logger.info('Stream orchestration starting', {
      provider,
      mixOfAgents: options?.mixOfAgents || false,
      logType: 'info',
    });

    if (options?.mixOfAgents) {
      await handleMixOfAgents(messages, callbacks);
    } else {
      await handleSingleProvider(messages, provider, callbacks);
    }
  } catch (error) {
    logger.error('Stream orchestration error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

async function handleSingleProvider(
  messages: ChatMessage[],
  provider: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const circuitBreaker = getCircuitBreaker(provider);
  
  await circuitBreaker.execute(
    async () => {
      if (provider === 'openai') {
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
      } else if (provider === 'luxia') {
        await handleLuxiaStream(messages, callbacks);
      } else {
        let response: string | null = null;
        
        switch (provider) {
          case 'claude':
            response = await chatWithClaude(messages);
            break;
          case 'gemini':
            response = await chatWithGemini(messages);
            break;
          case 'perplexity':
            response = await chatWithPerplexity(messages);
            break;
          default:
            response = await chatWithClaude(messages);
        }
        
        if (response) {
          callbacks.onChunk(response);
          callbacks.onComplete(response);
        } else {
          callbacks.onError(new Error(`No response from ${provider}`));
        }
      }
    },
    async () => {
      callbacks.onError(new Error('Circuit breaker is open'));
    }
  );
}

async function handleMixOfAgents(
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const providers = ['openai', 'claude', 'gemini'];
  const responses: { provider: string; response: string }[] = [];
  let fullResponse = '';
  
  const headerText = '## Mix of Agents 모드\n\n여러 AI의 응답을 순차적으로 수집합니다.\n\n---\n\n';
  fullResponse += headerText;
  callbacks.onChunk(headerText);
  
  for (const provider of providers) {
    try {
      const providerHeader = `### ${getProviderName(provider)}\n\n`;
      callbacks.onChunk(providerHeader);
      fullResponse += providerHeader;
      
      if (provider === 'openai') {
        let providerResponse = providerHeader;
        
        await chatWithOpenAIStream(messages, {
          onChunk: (chunk: string) => {
            providerResponse += chunk;
            fullResponse += chunk;
            callbacks.onChunk(chunk);
          },
          onComplete: () => {
            const footer = '\n\n---\n\n';
            providerResponse += footer;
            fullResponse += footer;
            callbacks.onChunk(footer);
            responses.push({ provider, response: providerResponse });
          },
          onError: (error: Error) => {
            const errorText = `\n\n*오류 발생: ${error.message}*\n\n---\n\n`;
            fullResponse += errorText;
            callbacks.onChunk(errorText);
          },
        });
      } else {
        const loadingText = '*응답 생성 중...*\n';
        callbacks.onChunk(loadingText);
        
        let response: string | null = null;
        
        switch (provider) {
          case 'claude':
            response = await chatWithClaude(messages);
            break;
          case 'gemini':
            response = await chatWithGemini(messages);
            break;
        }
        
        const clearLoading = '\r                    \r';
        callbacks.onChunk(clearLoading);
        
        if (response) {
          const words = response.split(' ');
          let providerResponseText = '';
          
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            providerResponseText += word;
            fullResponse += word;
            callbacks.onChunk(word);
            
            if (i % 5 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
          
          const footer = '\n\n---\n\n';
          fullResponse += footer;
          callbacks.onChunk(footer);
          responses.push({ provider, response: providerHeader + providerResponseText });
        } else {
          const noResponseText = '*응답을 받지 못했습니다.*\n\n---\n\n';
          fullResponse += noResponseText;
          callbacks.onChunk(noResponseText);
        }
      }
    } catch (error) {
      logger.warning(`Mix of agents: ${provider} failed`, {
        error: error instanceof Error ? error.message : 'Unknown',
        logType: 'warning',
      });
      const errorText = `*오류 발생*\n\n---\n\n`;
      fullResponse += errorText;
      callbacks.onChunk(errorText);
    }
  }
  
  if (responses.length === 0) {
    callbacks.onError(new Error('All providers failed'));
    return;
  }
  
  callbacks.onComplete(fullResponse);
}

async function handleLuxiaStream(
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const stream = await streamLuxia(messages);
    
    if (!stream) {
      logger.warning('Luxia stream not available, falling back to non-stream', {
        logType: 'warning',
      });
      await handleLuxiaFallback(messages, callbacks);
      return;
    }
    
    let fullResponse = '';
    let buffer = '';
    let hasError = false;
    
    stream.on('data', (chunk: Buffer) => {
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
            // Skip unparseable lines
          }
        }
      }
    });
    
    await new Promise<void>((resolve, reject) => {
      stream.on('end', () => {
        if (fullResponse) {
          callbacks.onComplete(fullResponse);
        }
        resolve();
      });
      stream.on('error', (error: Error) => {
        hasError = true;
        logger.warning('Luxia stream error, will fallback', {
          error: error.message,
          logType: 'warning',
        });
        reject(error);
      });
    });
  } catch (error) {
    logger.warning('Luxia stream failed, falling back to non-stream', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'warning',
    });
    await handleLuxiaFallback(messages, callbacks);
  }
}

async function handleLuxiaFallback(
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const response = await chatWithLuxia(messages);
    if (response) {
      callbacks.onChunk(response);
      callbacks.onComplete(response);
    } else {
      callbacks.onError(new Error('Luxia API returned no response'));
    }
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error('Luxia fallback failed'));
  }
}

async function getOpenAINonStream(messages: ChatMessage[]): Promise<string | null> {
  const { chatWithOpenAI } = await import('./openai.js');
  return chatWithOpenAI(messages);
}

function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI GPT-4',
    claude: 'Claude 3',
    gemini: 'Google Gemini',
    perplexity: 'Perplexity AI',
    luxia: 'Luxia AI',
  };
  return names[provider] || provider;
}

function formatMixedResponses(responses: { provider: string; response: string }[]): string {
  let result = '---\n\n## Mix of Agents 종합 응답\n\n';
  
  for (const { provider, response } of responses) {
    result += `### ${getProviderName(provider)}\n\n${response}\n\n---\n\n`;
  }
  
  return result;
}
