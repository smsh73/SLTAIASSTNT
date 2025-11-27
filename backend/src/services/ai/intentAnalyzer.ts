import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'IntentAnalyzer',
});

export interface Intent {
  type: 'table' | 'research' | 'code' | 'document' | 'summary' | 'statistics' | 'general';
  confidence: number;
  preferredProvider?: 'openai' | 'claude' | 'gemini' | 'perplexity' | 'luxia';
}

const INTENT_KEYWORDS = {
  table: ['표', '테이블', 'table', '데이터표', '비교표', '통계표'],
  research: ['리서치', '조사', 'research', '보고서', '분석', '트렌드'],
  code: ['코드', 'code', '프로그램', '스크립트', '자동화', 'python'],
  document: ['문서', 'document', '파일', '업로드', '요약'],
  summary: ['요약', 'summary', '정리', '핵심', '요점'],
  statistics: ['통계', 'statistics', '분석', '데이터', '시각화'],
};

export function analyzeIntent(prompt: string): Intent {
  const lowerPrompt = prompt.toLowerCase();
  const scores: Record<string, number> = {};

  // 키워드 매칭으로 점수 계산
  for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > 0) {
      scores[intentType] = score;
    }
  }

  // 가장 높은 점수의 의도 선택
  const maxScore = Math.max(...Object.values(scores), 0);
  const intentType = Object.keys(scores).find(
    (key) => scores[key] === maxScore
  ) as Intent['type'] || 'general';

  // 의도별 추천 프로바이더
  const providerMap: Record<string, Intent['preferredProvider']> = {
    table: 'claude',
    research: 'perplexity',
    code: 'openai',
    document: 'claude',
    summary: 'gemini',
    statistics: 'openai',
    general: 'openai',
  };

  logger.debug('Intent analyzed', {
    prompt: prompt.substring(0, 100),
    intentType,
    confidence: maxScore,
    logType: 'success',
  });

  return {
    type: intentType,
    confidence: maxScore / 5, // 정규화 (0-1)
    preferredProvider: providerMap[intentType],
  };
}

