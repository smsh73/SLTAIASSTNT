import { createLogger } from '../utils/logger.js';

const logger = createLogger({
  screenName: 'PromptSuggestion',
  callerFunction: 'generateSuggestions',
});

// 프롬프트 예시 템플릿
const PROMPT_TEMPLATES = [
  {
    keywords: ['표', '테이블', 'table'],
    suggestions: [
      '2024년 한국 IT 산업 통계표를 만들어줘',
      '월별 매출 데이터를 표로 정리해줘',
      '비교 분석표를 작성해줘',
    ],
  },
  {
    keywords: ['리서치', '조사', 'research', '보고서'],
    suggestions: [
      'AI 시장 동향에 대한 리서치 보고서를 작성해줘',
      '최신 기술 트렌드를 조사하고 보고서로 정리해줘',
      '경쟁사 분석 보고서를 만들어줘',
    ],
  },
  {
    keywords: ['요약', 'summary', '정리'],
    suggestions: [
      '이 문서의 주요 내용을 요약해줘',
      '회의록을 간단히 정리해줘',
      '핵심 포인트만 추출해줘',
    ],
  },
  {
    keywords: ['통계', 'statistics', '분석'],
    suggestions: [
      '데이터를 통계적으로 분석해줘',
      '트렌드 분석을 수행해줘',
      '데이터 시각화를 위한 통계를 계산해줘',
    ],
  },
  {
    keywords: ['코드', 'code', '프로그램'],
    suggestions: [
      'Python으로 데이터 분석 코드를 작성해줘',
      '자동화 스크립트를 만들어줘',
      '데이터 처리 코드를 생성해줘',
    ],
  },
];

export async function generateSuggestions(
  words: string[]
): Promise<string[]> {
  try {
    const suggestions: string[] = [];
    const wordSet = new Set(words.map((w) => w.toLowerCase()));

    for (const template of PROMPT_TEMPLATES) {
      const hasKeyword = template.keywords.some((keyword) =>
        wordSet.has(keyword.toLowerCase())
      );

      if (hasKeyword) {
        suggestions.push(...template.suggestions);
      }
    }

    // 기본 제안 (키워드가 없을 때) - 실제 사용 사례 기반
    if (suggestions.length === 0) {
      const currentTime = new Date().getHours();
      const timeBasedSuggestions = currentTime >= 9 && currentTime < 18 
        ? [
            '오늘의 업무 일정을 정리해줘',
            '프로젝트 진행 상황을 표로 정리해줘',
            '고객사 요청 자료를 작성해줘',
          ]
        : [
            '내일 회의 자료를 준비해줘',
            '주간 리포트를 작성해줘',
            '데이터 분석 결과를 표로 만들어줘',
          ];
      
      suggestions.push(...timeBasedSuggestions);
    }

    logger.debug('Generated prompt suggestions', {
      wordCount: words.length,
      suggestionCount: suggestions.length,
      logType: 'success',
    });

    return suggestions.slice(0, 5); // 최대 5개만 반환
  } catch (error) {
    logger.error('Failed to generate suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return [];
  }
}

