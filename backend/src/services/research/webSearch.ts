import { chatWithPerplexity } from '../ai/perplexity.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Research',
  callerFunction: 'WebSearch',
});

export interface SearchResult {
  query: string;
  results: {
    title: string;
    url?: string;
    snippet: string;
  }[];
  timestamp: string;
}

export async function searchWeb(
  query: string,
  maxResults: number = 10
): Promise<SearchResult> {
  try {
    // Perplexity는 온라인 검색 기능이 있으므로 사용
    const response = await chatWithPerplexity(
      [
        {
          role: 'system',
          content: '당신은 웹 검색 전문가입니다. 최신 정보를 검색하고 정리합니다.',
        },
        {
          role: 'user',
          content: `"${query}"에 대한 최신 정보를 검색하고 ${maxResults}개의 결과를 제공해주세요. 각 결과는 제목, URL(가능한 경우), 요약을 포함해주세요.`,
        },
      ],
      { model: 'llama-3-sonar-large-32k-online' }
    );

    if (!response) {
      throw new Error('Failed to search web');
    }

    // 응답을 파싱하여 SearchResult 생성
    const results: SearchResult['results'] = [];
    const lines = response.split('\n').filter((line) => line.trim().length > 0);

    for (let i = 0; i < lines.length && results.length < maxResults; i++) {
      const line = lines[i];
      if (line.match(/^\d+\.|^[-*]/)) {
        const title = line.replace(/^\d+\.\s*|^[-*]\s*/, '').trim();
        const snippet = i + 1 < lines.length ? lines[i + 1].trim() : '';
        results.push({
          title,
          snippet,
        });
      }
    }

    const searchResult: SearchResult = {
      query,
      results: results.length > 0 ? results : [{ title: query, snippet: response }],
      timestamp: new Date().toISOString(),
    };

    logger.success('Web search completed', {
      query,
      resultCount: searchResult.results.length,
      logType: 'success',
    });

    return searchResult;
  } catch (error) {
    logger.error('Web search error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query,
      logType: 'error',
    });
    throw error;
  }
}

