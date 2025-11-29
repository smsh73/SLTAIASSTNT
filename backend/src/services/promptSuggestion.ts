import { createLogger } from '../utils/logger.js';
import { chatWithLuxia, getLuxiaApiKey } from './ai/luxia.js';

const logger = createLogger({
  screenName: 'PromptSuggestion',
  callerFunction: 'generateSuggestions',
});

const FALLBACK_SUGGESTIONS = [
  '이 내용에 대해 더 자세히 설명해줘',
  '관련 데이터를 표로 정리해줘',
  '핵심 포인트를 요약해줘',
  '예시를 들어 설명해줘',
  '비교 분석을 해줘',
];

export async function generateSuggestions(
  words: string[]
): Promise<string[]> {
  try {
    const userInput = words.join(' ').trim();
    
    if (!userInput || userInput.length < 2) {
      return [];
    }

    const apiKey = await getLuxiaApiKey();
    if (!apiKey) {
      logger.warning('Luxia API key not available, using fallback suggestions', {
        logType: 'warning',
      });
      return getContextualFallback(userInput);
    }

    const systemPrompt = `당신은 AI 프롬프트 자동완성 도우미입니다. 사용자가 입력 중인 텍스트를 기반으로 완성된 프롬프트를 제안해야 합니다.

규칙:
1. 사용자의 입력 의도를 파악하여 3-5개의 완성된 프롬프트를 제안하세요.
2. 각 제안은 실용적이고 구체적이어야 합니다.
3. JSON 배열 형식으로만 응답하세요: ["제안1", "제안2", "제안3"]
4. 한국어로 제안하세요.
5. 각 제안은 20-50자 사이로 간결하게 작성하세요.
6. 비즈니스/업무 관련 프롬프트를 우선시하세요.`;

    const userMessage = `사용자가 현재 입력 중인 텍스트: "${userInput}"

위 텍스트를 기반으로 완성된 프롬프트 제안을 JSON 배열로 제공하세요.`;

    const response = await chatWithLuxia(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { 
        temperature: 0.7, 
        maxTokens: 512,
      }
    );

    if (!response) {
      logger.warning('Luxia returned no response, using fallback', {
        logType: 'warning',
      });
      return getContextualFallback(userInput);
    }

    const suggestions = parseSuggestions(response);
    
    if (suggestions.length === 0) {
      return getContextualFallback(userInput);
    }

    logger.debug('Generated prompt suggestions via Luxia', {
      userInput: userInput.substring(0, 50),
      suggestionCount: suggestions.length,
      logType: 'success',
    });

    return suggestions.slice(0, 5);
  } catch (error) {
    logger.error('Failed to generate suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return getContextualFallback(words.join(' '));
  }
}

function parseSuggestions(response: string): string[] {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map(item => item.trim());
      }
    }
    
    const lines = response.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('[') && 
             !trimmed.startsWith(']') &&
             !trimmed.startsWith('{');
    });
    
    if (lines.length > 0) {
      return lines.slice(0, 5).map(line => 
        line.replace(/^[\d\.\-\*\)]+\s*/, '').replace(/^["']|["']$/g, '').trim()
      ).filter(line => line.length > 0);
    }
    
    return [];
  } catch (error) {
    logger.warning('Failed to parse Luxia response', {
      response: response.substring(0, 100),
      logType: 'warning',
    });
    return [];
  }
}

function getContextualFallback(userInput: string): string[] {
  const input = userInput.toLowerCase();
  
  if (input.includes('표') || input.includes('테이블') || input.includes('table')) {
    return [
      `${userInput} 데이터를 표로 정리해줘`,
      `${userInput} 비교표를 만들어줘`,
      `${userInput} 통계표를 작성해줘`,
    ];
  }
  
  if (input.includes('분석') || input.includes('리서치') || input.includes('조사')) {
    return [
      `${userInput}에 대한 심층 분석을 해줘`,
      `${userInput} 보고서를 작성해줘`,
      `${userInput} 트렌드를 분석해줘`,
    ];
  }
  
  if (input.includes('코드') || input.includes('프로그램') || input.includes('개발')) {
    return [
      `${userInput} 코드를 작성해줘`,
      `${userInput} 예제 코드를 보여줘`,
      `${userInput} 구현 방법을 설명해줘`,
    ];
  }
  
  if (input.includes('요약') || input.includes('정리')) {
    return [
      `${userInput} 핵심 내용을 정리해줘`,
      `${userInput} 간단히 요약해줘`,
      `${userInput} 주요 포인트를 추출해줘`,
    ];
  }
  
  return [
    `${userInput}에 대해 자세히 설명해줘`,
    `${userInput} 관련 정보를 정리해줘`,
    `${userInput}을 분석해줘`,
    `${userInput} 예시를 보여줘`,
  ].slice(0, 4);
}
