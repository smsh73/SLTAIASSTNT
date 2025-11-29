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

export type ChatMode = 'normal' | 'mix' | 'a2a';

export interface StreamOptions {
  preferredProvider?: string;
  chatMode?: ChatMode;
}

export async function orchestrateAIStream(
  messages: ChatMessage[],
  userPrompt: string,
  callbacks: StreamCallbacks,
  options?: StreamOptions
): Promise<void> {
  try {
    let provider = options?.preferredProvider;
    const chatMode = options?.chatMode || 'normal';
    
    if (!provider) {
      const intent = analyzeIntent(userPrompt);
      provider = await selectProvider(intent.preferredProvider) || 'openai';
    }
    
    logger.info('Stream orchestration starting', {
      provider,
      chatMode,
      logType: 'info',
    });

    switch (chatMode) {
      case 'mix':
        await handleMixOfAgents(messages, callbacks);
        break;
      case 'a2a':
        await handleA2AMode(messages, userPrompt, callbacks);
        break;
      default:
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

async function handleA2AMode(
  messages: ChatMessage[],
  userPrompt: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const providers = ['openai', 'claude', 'gemini', 'perplexity'];
  const conversationHistory: { provider: string; content: string; phase: string; round: number }[] = [];
  let fullResponse = '';

  const header = `## A2A 협력 토론 모드\n\n여러 AI 에이전트가 협력하여 최적의 답변을 도출합니다.\n\n**주제**: ${userPrompt}\n\n---\n\n`;
  fullResponse += header;
  callbacks.onChunk(header);

  const phase1Header = `### 1단계: 협력적 인사이트 공유 (2라운드)\n\n`;
  fullResponse += phase1Header;
  callbacks.onChunk(phase1Header);

  for (let round = 1; round <= 2; round++) {
    const roundHeader = `#### 라운드 ${round}\n\n`;
    fullResponse += roundHeader;
    callbacks.onChunk(roundHeader);

    for (const provider of providers) {
      try {
        const providerHeader = `**${getProviderName(provider)}**:\n`;
        fullResponse += providerHeader;
        callbacks.onChunk(providerHeader);

        const contextMessages = buildA2AContextMessages(
          userPrompt,
          conversationHistory,
          provider,
          'collaboration',
          round
        );

        const response = await getProviderResponse(provider, contextMessages);
        
        if (response) {
          const words = response.split(' ');
          let providerResponse = '';
          
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            providerResponse += word;
            fullResponse += word;
            callbacks.onChunk(word);
            
            if (i % 8 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }

          conversationHistory.push({
            provider,
            content: providerResponse,
            phase: 'collaboration',
            round,
          });

          const footer = '\n\n';
          fullResponse += footer;
          callbacks.onChunk(footer);
        } else {
          const noResponse = '*응답을 받지 못했습니다.*\n\n';
          fullResponse += noResponse;
          callbacks.onChunk(noResponse);
        }
      } catch (error) {
        logger.warning(`A2A: ${provider} failed in collaboration round ${round}`, {
          error: error instanceof Error ? error.message : 'Unknown',
          logType: 'warning',
        });
        const errorText = `*오류 발생*\n\n`;
        fullResponse += errorText;
        callbacks.onChunk(errorText);
      }
    }
  }

  const phase2Header = `---\n\n### 2단계: 토론 및 보완 (2라운드)\n\n`;
  fullResponse += phase2Header;
  callbacks.onChunk(phase2Header);

  for (let round = 1; round <= 2; round++) {
    const roundHeader = `#### 토론 라운드 ${round}\n\n`;
    fullResponse += roundHeader;
    callbacks.onChunk(roundHeader);

    for (const provider of providers) {
      try {
        const providerHeader = `**${getProviderName(provider)}**:\n`;
        fullResponse += providerHeader;
        callbacks.onChunk(providerHeader);

        const contextMessages = buildA2AContextMessages(
          userPrompt,
          conversationHistory,
          provider,
          'debate',
          round
        );

        const response = await getProviderResponse(provider, contextMessages);
        
        if (response) {
          const words = response.split(' ');
          let providerResponse = '';
          
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            providerResponse += word;
            fullResponse += word;
            callbacks.onChunk(word);
            
            if (i % 8 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }

          conversationHistory.push({
            provider,
            content: providerResponse,
            phase: 'debate',
            round,
          });

          const footer = '\n\n';
          fullResponse += footer;
          callbacks.onChunk(footer);
        } else {
          const noResponse = '*응답을 받지 못했습니다.*\n\n';
          fullResponse += noResponse;
          callbacks.onChunk(noResponse);
        }
      } catch (error) {
        logger.warning(`A2A: ${provider} failed in debate round ${round}`, {
          error: error instanceof Error ? error.message : 'Unknown',
          logType: 'warning',
        });
        const errorText = `*오류 발생*\n\n`;
        fullResponse += errorText;
        callbacks.onChunk(errorText);
      }
    }
  }

  const synthesisHeader = `---\n\n### 3단계: Luxia AI 최종 종합\n\n`;
  fullResponse += synthesisHeader;
  callbacks.onChunk(synthesisHeader);

  try {
    const synthesisMessages = buildSynthesisMessages(userPrompt, conversationHistory);
    const synthesisResponse = await chatWithLuxia(synthesisMessages);
    
    if (synthesisResponse) {
      const words = synthesisResponse.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? ' ' : '');
        fullResponse += word;
        callbacks.onChunk(word);
        
        if (i % 8 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    } else {
      const fallbackHeader = '*Luxia 응답 실패, Claude로 대체 종합 중...*\n\n';
      fullResponse += fallbackHeader;
      callbacks.onChunk(fallbackHeader);
      
      const fallbackResponse = await chatWithClaude(synthesisMessages);
      if (fallbackResponse) {
        const words = fallbackResponse.split(' ');
        for (let i = 0; i < words.length; i++) {
          const word = words[i] + (i < words.length - 1 ? ' ' : '');
          fullResponse += word;
          callbacks.onChunk(word);
          if (i % 8 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }
    }
  } catch (error) {
    logger.error('A2A synthesis failed', {
      error: error instanceof Error ? error.message : 'Unknown',
      logType: 'error',
    });
    const errorText = '\n\n*최종 종합 중 오류가 발생했습니다.*';
    fullResponse += errorText;
    callbacks.onChunk(errorText);
  }

  const endFooter = '\n\n---\n\n*A2A 협력 토론이 완료되었습니다.*';
  fullResponse += endFooter;
  callbacks.onChunk(endFooter);

  callbacks.onComplete(fullResponse);
}

function buildA2AContextMessages(
  userPrompt: string,
  history: { provider: string; content: string; phase: string; round: number }[],
  currentProvider: string,
  phase: 'collaboration' | 'debate',
  round: number
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  
  let systemPrompt = '';
  
  if (phase === 'collaboration') {
    systemPrompt = `당신은 ${getProviderName(currentProvider)}입니다. 다른 AI 에이전트들과 함께 협력하여 사용자의 질문에 대한 최적의 답변을 도출하는 토론에 참여하고 있습니다.

지금은 협력적 인사이트 공유 단계 ${round}라운드입니다.
- 이전 발언자들의 의견을 참고하여 새로운 관점이나 보완적인 인사이트를 제시하세요.
- 다른 에이전트의 좋은 아이디어는 인정하고 발전시키세요.
- 간결하면서도 핵심적인 내용을 담아 2-3문단 이내로 답변하세요.
- 한국어로 답변하세요.`;
  } else {
    systemPrompt = `당신은 ${getProviderName(currentProvider)}입니다. 다른 AI 에이전트들과 함께 토론하며 답변을 개선하고 있습니다.

지금은 토론 및 보완 단계 ${round}라운드입니다.
- 지금까지의 논의에서 부족한 점이나 보완이 필요한 부분을 지적하세요.
- 건설적인 비평과 함께 개선된 인사이트를 제안하세요.
- 다른 에이전트들의 의견 중 동의하지 않는 부분이 있다면 논리적으로 반박하세요.
- 간결하면서도 핵심적인 내용을 담아 2-3문단 이내로 답변하세요.
- 한국어로 답변하세요.`;
  }

  messages.push({ role: 'system', content: systemPrompt });

  let conversationContext = `사용자 질문: ${userPrompt}\n\n`;
  
  if (history.length > 0) {
    conversationContext += '지금까지의 토론 내용:\n\n';
    for (const entry of history) {
      conversationContext += `[${getProviderName(entry.provider)} - ${entry.phase === 'collaboration' ? '협력' : '토론'} ${entry.round}라운드]\n${entry.content}\n\n`;
    }
  }

  messages.push({ role: 'user', content: conversationContext });

  return messages;
}

function buildSynthesisMessages(
  userPrompt: string,
  history: { provider: string; content: string; phase: string; round: number }[]
): ChatMessage[] {
  const systemPrompt = `당신은 Luxia AI입니다. 여러 AI 에이전트들의 협력적 토론 결과를 종합하여 최종 답변을 제시하는 역할을 맡고 있습니다.

다음 사항을 고려하여 최종 종합 답변을 작성하세요:
1. 모든 에이전트들의 핵심 인사이트를 통합하세요.
2. 토론 과정에서 합의된 내용과 개선된 점을 반영하세요.
3. 상충되는 의견이 있었다면 가장 논리적이고 타당한 결론을 도출하세요.
4. 실용적이고 실행 가능한 최종 답변을 구성하세요.
5. 한국어로 답변하세요.`;

  let conversationSummary = `원래 질문: ${userPrompt}\n\n=== 토론 전체 내용 ===\n\n`;

  const collaborationEntries = history.filter(h => h.phase === 'collaboration');
  const debateEntries = history.filter(h => h.phase === 'debate');

  if (collaborationEntries.length > 0) {
    conversationSummary += '## 협력적 인사이트 공유 단계\n\n';
    for (const entry of collaborationEntries) {
      conversationSummary += `**${getProviderName(entry.provider)}** (라운드 ${entry.round}):\n${entry.content}\n\n`;
    }
  }

  if (debateEntries.length > 0) {
    conversationSummary += '## 토론 및 보완 단계\n\n';
    for (const entry of debateEntries) {
      conversationSummary += `**${getProviderName(entry.provider)}** (라운드 ${entry.round}):\n${entry.content}\n\n`;
    }
  }

  conversationSummary += '\n위의 토론 내용을 바탕으로 최종 종합 답변을 작성해주세요.';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: conversationSummary },
  ];
}

async function getProviderResponse(
  provider: string,
  messages: ChatMessage[]
): Promise<string | null> {
  switch (provider) {
    case 'openai':
      return getOpenAINonStream(messages);
    case 'claude':
      return chatWithClaude(messages);
    case 'gemini':
      return chatWithGemini(messages);
    case 'perplexity':
      return chatWithPerplexity(messages);
    case 'luxia':
      return chatWithLuxia(messages);
    default:
      return null;
  }
}
