import { ChatMessage } from './router.js';
import { createLogger } from '../../utils/logger.js';
import { getCircuitBreaker } from './circuitBreaker.js';
import { chatWithOpenAIStream } from './openai-stream.js';
import { chatWithClaude, chatWithClaudeStream } from './claude.js';
import { chatWithGemini, chatWithGeminiStream } from './gemini.js';
import { chatWithPerplexity, chatWithPerplexityStream } from './perplexity.js';
import { chatWithLuxia, streamLuxia } from './luxia.js';
import { selectProvider } from './weightManager.js';
import { analyzeIntent } from './intentAnalyzer.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'OrchestratorStream',
});

function getKoreanDate(): string {
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = koreaTime.getFullYear();
  const month = koreaTime.getMonth() + 1;
  const day = koreaTime.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[koreaTime.getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday}요일)`;
}

function buildSystemPrompt(provider: string): string {
  const koreanDate = getKoreanDate();
  const providerName = getProviderName(provider);
  
  return `오늘 날짜는 ${koreanDate}입니다. (한국 표준시 기준)
당신은 ${providerName} AI 어시스턴트입니다.
사용자의 질문에 친절하고 정확하게 답변해주세요.
한국어로 답변하세요.

중요: 답변의 마지막에 반드시 다음 형식으로 시그니처를 추가하세요:
---
*${providerName}*`;
}

function addSystemPromptToMessages(messages: ChatMessage[], provider: string): ChatMessage[] {
  const systemPrompt = buildSystemPrompt(provider);
  const hasSystemMessage = messages.some(m => m.role === 'system');
  
  if (hasSystemMessage) {
    return messages.map(m => 
      m.role === 'system' 
        ? { ...m, content: `${systemPrompt}\n\n${m.content}` }
        : m
    );
  }
  
  return [{ role: 'system', content: systemPrompt }, ...messages];
}

async function streamTextWithTypingEffect(
  text: string, 
  onChunk: (chunk: string) => void,
  delayMs: number = 3
): Promise<void> {
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? ' ' : '');
    onChunk(word);
    
    if (i % 3 === 0 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  onAgentStart?: (provider: string, providerName: string, phase: string, round: number) => void;
  onAgentComplete?: (provider: string, fullContent: string) => void;
  onPhaseChange?: (phase: string) => void;
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
    
    logger.info('=== ORCHESTRATION START ===', {
      receivedChatMode: chatMode,
      receivedProvider: provider,
      optionsRaw: JSON.stringify(options),
      logType: 'info',
    });
    
    if (!provider || provider === 'auto') {
      const intent = analyzeIntent(userPrompt);
      provider = await selectProvider(intent.preferredProvider) || 'openai';
      logger.info('Auto-selected provider', { provider, logType: 'info' });
    }
    
    logger.info('Stream orchestration starting', {
      provider,
      chatMode,
      logType: 'info',
    });

    if (chatMode === 'a2a') {
      logger.info('=== A2A MODE DETECTED - Starting A2A handler ===', { logType: 'info' });
      await handleA2AMode(messages, userPrompt, callbacks);
      return;
    }
    
    if (chatMode === 'mix') {
      logger.info('=== MIX MODE DETECTED - Starting Mix handler ===', { logType: 'info' });
      await handleMixOfAgents(messages, callbacks);
      return;
    }
    
    logger.info('=== NORMAL MODE - Starting single provider ===', { logType: 'info' });
    await handleSingleProvider(messages, provider, callbacks);
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
  const messagesWithSystem = addSystemPromptToMessages(messages, provider);
  
  await circuitBreaker.execute(
    async () => {
      if (provider === 'openai') {
        let fullResponse = '';
        await chatWithOpenAIStream(messagesWithSystem, {
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
        await handleLuxiaStream(messagesWithSystem, callbacks);
      } else {
        logger.info(`Starting non-streaming provider: ${provider}`, { 
          provider,
          logType: 'info' 
        });
        
        let response: string | null = null;
        
        switch (provider) {
          case 'claude':
            logger.info('Calling Claude API...', { logType: 'info' });
            response = await chatWithClaude(messagesWithSystem);
            break;
          case 'gemini':
            logger.info('Calling Gemini API...', { logType: 'info' });
            response = await chatWithGemini(messagesWithSystem);
            break;
          case 'perplexity':
            logger.info('Calling Perplexity API...', { logType: 'info' });
            response = await chatWithPerplexity(messagesWithSystem);
            break;
          default:
            logger.info(`Unknown provider ${provider}, falling back to Claude`, { logType: 'warning' });
            response = await chatWithClaude(messagesWithSystem);
        }
        
        logger.info(`Provider ${provider} response received`, { 
          provider,
          hasResponse: !!response,
          responseLength: response?.length || 0,
          logType: response ? 'success' : 'warning' 
        });
        
        if (response) {
          await streamTextWithTypingEffect(response, callbacks.onChunk);
          callbacks.onComplete(response);
        } else {
          logger.error(`No response from ${provider}`, { provider, logType: 'error' });
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
      
      const messagesWithSystem = addSystemPromptToMessages(messages, provider);
      
      if (provider === 'openai') {
        let providerResponse = providerHeader;
        
        await chatWithOpenAIStream(messagesWithSystem, {
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
        let response: string | null = null;
        
        switch (provider) {
          case 'claude':
            response = await chatWithClaude(messagesWithSystem);
            break;
          case 'gemini':
            response = await chatWithGemini(messagesWithSystem);
            break;
          case 'perplexity':
            response = await chatWithPerplexity(messagesWithSystem);
            break;
        }
        
        if (response) {
          let providerResponseText = '';
          await streamTextWithTypingEffect(response, (word) => {
            providerResponseText += word;
            fullResponse += word;
            callbacks.onChunk(word);
          });
          
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
      await streamTextWithTypingEffect(response, callbacks.onChunk);
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
    openai: 'OpenAI GPT-4.1',
    claude: 'Claude Sonnet 4.5',
    gemini: 'Google Gemini 2.5',
    perplexity: 'Perplexity Sonar Pro',
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

async function streamProviderResponse(
  provider: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<string> {
  let fullResponse = '';
  
  const streamCallbacks = {
    onChunk: (chunk: string) => {
      fullResponse += chunk;
      callbacks.onChunk(chunk);
    },
    onComplete: () => {},
    onError: (error: Error) => {
      throw error;
    },
  };

  const streamCallbacksWithResponse = {
    onChunk: (chunk: string) => {
      fullResponse += chunk;
      callbacks.onChunk(chunk);
    },
    onComplete: (_response: string) => {},
    onError: (error: Error) => {
      throw error;
    },
  };

  switch (provider) {
    case 'openai':
      await chatWithOpenAIStream(messages, streamCallbacks);
      break;
    case 'claude':
      await chatWithClaudeStream(messages, streamCallbacksWithResponse);
      break;
    case 'gemini':
      await chatWithGeminiStream(messages, streamCallbacksWithResponse);
      break;
    case 'perplexity':
      await chatWithPerplexityStream(messages, streamCallbacksWithResponse);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return fullResponse;
}

async function handleA2AMode(
  messages: ChatMessage[],
  userPrompt: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const providers = ['openai', 'claude', 'gemini', 'perplexity'];
  const conversationHistory: { provider: string; content: string; phase: string; round: number }[] = [];
  let fullResponse = '';

  logger.info('A2A mode started', {
    providers: providers.join(', '),
    userPrompt: userPrompt.substring(0, 50),
    logType: 'info',
  });

  callbacks.onPhaseChange?.('collaboration');

  for (let round = 1; round <= 2; round++) {
    for (const provider of providers) {
      try {
        logger.info(`A2A: Calling ${provider} for collaboration round ${round}`, {
          logType: 'info',
        });

        callbacks.onAgentStart?.(provider, getProviderName(provider), 'collaboration', round);

        const contextMessages = buildA2AContextMessages(
          userPrompt,
          conversationHistory,
          provider,
          'collaboration',
          round
        );

        const providerResponse = await streamProviderResponse(provider, contextMessages, callbacks);
        
        logger.info(`A2A: ${provider} streaming completed`, {
          responseLength: providerResponse.length,
          logType: 'success',
        });

        if (providerResponse) {
          fullResponse += providerResponse;
          conversationHistory.push({
            provider,
            content: providerResponse,
            phase: 'collaboration',
            round,
          });
        }
        
        callbacks.onAgentComplete?.(provider, providerResponse);
      } catch (error) {
        logger.warning(`A2A: ${provider} failed in collaboration round ${round}`, {
          error: error instanceof Error ? error.message : 'Unknown',
          logType: 'warning',
        });
        const errorText = `오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        callbacks.onChunk(errorText);
        callbacks.onAgentComplete?.(provider, errorText);
      }
    }
  }

  callbacks.onPhaseChange?.('debate');

  for (let round = 1; round <= 2; round++) {
    for (const provider of providers) {
      try {
        logger.info(`A2A: Calling ${provider} for debate round ${round}`, {
          logType: 'info',
        });

        callbacks.onAgentStart?.(provider, getProviderName(provider), 'debate', round);

        const contextMessages = buildA2AContextMessages(
          userPrompt,
          conversationHistory,
          provider,
          'debate',
          round
        );

        const providerResponse = await streamProviderResponse(provider, contextMessages, callbacks);
        
        logger.info(`A2A: ${provider} debate streaming completed`, {
          responseLength: providerResponse.length,
          logType: 'success',
        });

        if (providerResponse) {
          fullResponse += providerResponse;
          conversationHistory.push({
            provider,
            content: providerResponse,
            phase: 'debate',
            round,
          });
        }
        
        callbacks.onAgentComplete?.(provider, providerResponse);
      } catch (error) {
        logger.warning(`A2A: ${provider} failed in debate round ${round}`, {
          error: error instanceof Error ? error.message : 'Unknown',
          logType: 'warning',
        });
        const errorText = `오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        callbacks.onChunk(errorText);
        callbacks.onAgentComplete?.(provider, errorText);
      }
    }
  }

  logger.info('=== A2A: Starting synthesis phase ===', {
    historyLength: conversationHistory.length,
    logType: 'info',
  });

  callbacks.onPhaseChange?.('synthesis');
  callbacks.onAgentStart?.('luxia', 'Luxia AI', 'synthesis', 1);

  let synthesisResponse = '';
  
  try {
    logger.info('A2A: Building synthesis messages for Luxia', { logType: 'info' });
    const synthesisMessages = buildSynthesisMessages(userPrompt, conversationHistory);
    
    logger.info('A2A: Attempting Luxia streaming...', { logType: 'info' });
    const stream = await streamLuxia(synthesisMessages);
    
    if (stream) {
      logger.info('A2A: Luxia stream obtained, starting to read...', { logType: 'info' });
      let buffer = '';
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  synthesisResponse += content;
                  fullResponse += content;
                  callbacks.onChunk(content);
                }
              } catch {}
            }
          }
        });
        stream.on('end', () => {
          logger.info('A2A: Luxia stream ended', { responseLength: synthesisResponse.length, logType: 'success' });
          resolve();
        });
        stream.on('error', (error: Error) => {
          logger.error('A2A: Luxia stream error event', { error: error.message, logType: 'error' });
          reject(error);
        });
      });
    } else {
      logger.warning('A2A: Luxia stream is null, using non-stream fallback', { logType: 'warning' });
      const luxiaResponse = await chatWithLuxia(synthesisMessages);
      if (luxiaResponse) {
        logger.info('A2A: Luxia non-stream response received', { responseLength: luxiaResponse.length, logType: 'success' });
        const words = luxiaResponse.split(' ');
        for (let i = 0; i < words.length; i++) {
          const word = words[i] + (i < words.length - 1 ? ' ' : '');
          synthesisResponse += word;
          fullResponse += word;
          callbacks.onChunk(word);
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 3));
          }
        }
      }
    }
  } catch (luxiaError) {
    logger.warning('Luxia failed, trying Claude fallback', {
      error: luxiaError instanceof Error ? luxiaError.message : 'Unknown',
      logType: 'warning',
    });
    
    try {
      const synthesisMessages = buildSynthesisMessages(userPrompt, conversationHistory);
      callbacks.onChunk('Claude로 대체 종합 중...\n\n');
      
      await new Promise<void>((resolve, reject) => {
        chatWithClaudeStream(synthesisMessages, {
          onChunk: (chunk: string) => {
            synthesisResponse += chunk;
            fullResponse += chunk;
            callbacks.onChunk(chunk);
          },
          onComplete: () => {
            logger.info('A2A: Claude fallback completed', { responseLength: synthesisResponse.length, logType: 'success' });
            resolve();
          },
          onError: (error: Error) => reject(error),
        });
      });
    } catch (claudeError) {
      logger.error('A2A synthesis failed completely', {
        error: claudeError instanceof Error ? claudeError.message : 'Unknown',
        logType: 'error',
      });
      const errorText = '최종 종합 중 오류가 발생했습니다.';
      callbacks.onChunk(errorText);
      synthesisResponse = errorText;
      fullResponse += errorText;
    }
  }
  
  logger.info('A2A: Synthesis phase completed', { 
    synthesisLength: synthesisResponse.length,
    totalLength: fullResponse.length,
    logType: 'success' 
  });
  
  callbacks.onAgentComplete?.('luxia', synthesisResponse);
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
  const koreanDate = getKoreanDate();
  const providerName = getProviderName(currentProvider);
  
  let systemPrompt = '';
  
  if (phase === 'collaboration') {
    systemPrompt = `오늘 날짜는 ${koreanDate}입니다. (한국 표준시 기준)

당신은 ${providerName}입니다. 다른 AI 에이전트들과 함께 협력하여 사용자의 질문에 대한 최적의 답변을 도출하는 토론에 참여하고 있습니다.

지금은 협력적 인사이트 공유 단계 ${round}라운드입니다.
- 이전 발언자들의 의견을 참고하여 새로운 관점이나 보완적인 인사이트를 제시하세요.
- 다른 에이전트의 좋은 아이디어는 인정하고 발전시키세요.
- 간결하면서도 핵심적인 내용을 담아 2-3문단 이내로 답변하세요.
- 한국어로 답변하세요.

중요: 답변의 마지막에 반드시 다음 형식으로 시그니처를 추가하세요:
---
*${providerName}*`;
  } else {
    systemPrompt = `오늘 날짜는 ${koreanDate}입니다. (한국 표준시 기준)

당신은 ${providerName}입니다. 다른 AI 에이전트들과 함께 토론하며 답변을 개선하고 있습니다.

지금은 토론 및 보완 단계 ${round}라운드입니다.
- 지금까지의 논의에서 부족한 점이나 보완이 필요한 부분을 지적하세요.
- 건설적인 비평과 함께 개선된 인사이트를 제안하세요.
- 다른 에이전트들의 의견 중 동의하지 않는 부분이 있다면 논리적으로 반박하세요.
- 간결하면서도 핵심적인 내용을 담아 2-3문단 이내로 답변하세요.
- 한국어로 답변하세요.

중요: 답변의 마지막에 반드시 다음 형식으로 시그니처를 추가하세요:
---
*${providerName}*`;
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
  const koreanDate = getKoreanDate();
  
  const systemPrompt = `오늘 날짜는 ${koreanDate}입니다. (한국 표준시 기준)

당신은 Luxia AI입니다. 여러 AI 에이전트들의 협력적 토론 결과를 종합하여 최종 답변을 제시하는 역할을 맡고 있습니다.

반드시 다음 형식으로 답변을 구성하세요:

## 📋 종합 Summary

각 AI의 핵심 인사이트를 불릿 포인트로 요약하고 간단한 해설을 추가하세요.

### 🤖 OpenAI GPT-4.1
• **핵심 포인트 1**: 해설 내용
• **핵심 포인트 2**: 해설 내용

### 🧠 Claude Sonnet 4.5
• **핵심 포인트 1**: 해설 내용
• **핵심 포인트 2**: 해설 내용

### ✨ Gemini 2.5 Flash
• **핵심 포인트 1**: 해설 내용
• **핵심 포인트 2**: 해설 내용

### 🔍 Perplexity Sonar Pro
• **핵심 포인트 1**: 해설 내용
• **핵심 포인트 2**: 해설 내용

---

## 🌟 Luxia AI 최종 종합 답변

위 AI들의 인사이트를 바탕으로 종합적인 최종 답변을 작성하세요.

---

### 💡 핵심 결론

가장 중요한 결론을 간결하게 정리하세요.

---
*Luxia AI*

작성 시 유의사항:
1. 각 AI별 섹션 사이에 충분한 간격을 두세요.
2. 불릿 포인트는 핵심 내용을 간결하게 정리하고, 해설은 1-2문장으로 작성하세요.
3. 토론에서 합의된 내용과 상충되는 의견을 균형 있게 반영하세요.
4. 실용적이고 실행 가능한 결론을 도출하세요.
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

  conversationSummary += '\n위의 토론 내용을 바탕으로 종합 Summary와 최종 답변을 작성해주세요.';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: conversationSummary },
  ];
}

async function getProviderResponse(
  provider: string,
  messages: ChatMessage[]
): Promise<string | null> {
  logger.info(`getProviderResponse: Starting call to ${provider}`, {
    messageCount: messages.length,
    logType: 'info',
  });
  
  try {
    let response: string | null = null;
    
    switch (provider) {
      case 'openai':
        response = await getOpenAINonStream(messages);
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
      default:
        logger.warning(`getProviderResponse: Unknown provider ${provider}`, { logType: 'warning' });
        return null;
    }
    
    logger.info(`getProviderResponse: ${provider} completed`, {
      hasResponse: !!response,
      responseLength: response?.length || 0,
      logType: response ? 'success' : 'warning',
    });
    
    return response;
  } catch (error) {
    logger.error(`getProviderResponse: ${provider} error`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      logType: 'error',
    });
    throw error;
  }
}
