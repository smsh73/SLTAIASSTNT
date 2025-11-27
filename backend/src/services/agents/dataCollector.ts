import { orchestrateAI } from '../ai/orchestrator.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Agents',
  callerFunction: 'DataCollector',
});

export interface CollectedData {
  source: string;
  data: any;
  timestamp: string;
  reliability?: number;
}

export async function collectDataFromWeb(
  query: string,
  maxResults: number = 10
): Promise<CollectedData[]> {
  try {
    // 웹 검색을 위해 Perplexity 사용 (온라인 검색 기능)
    const prompt = `다음 주제에 대한 최신 정보를 검색하고 정리해주세요: ${query}\n\n최대 ${maxResults}개의 결과를 제공해주세요.`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 웹 검색 및 데이터 수집 전문가입니다. 최신 정보를 검색하고 정리합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to collect data');
    }

    // 응답을 파싱하여 CollectedData 배열 생성
    const data: CollectedData[] = [
      {
        source: 'web-search',
        data: response,
        timestamp: new Date().toISOString(),
        reliability: 0.8,
      },
    ];

    logger.success('Data collected from web', {
      query,
      resultCount: data.length,
      logType: 'success',
    });

    return data;
  } catch (error) {
    logger.error('Failed to collect data from web', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query,
      logType: 'error',
    });
    throw error;
  }
}

export async function collectDataFromDocuments(
  documents: string[],
  query: string
): Promise<CollectedData[]> {
  try {
    const prompt = `다음 문서들에서 "${query}"에 관련된 정보를 추출하고 정리해주세요:\n\n${documents.join('\n\n---\n\n')}`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 문서 분석 전문가입니다. 문서에서 관련 정보를 추출하고 정리합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to collect data from documents');
    }

    const data: CollectedData[] = documents.map((doc, index) => ({
      source: `document-${index}`,
      data: response,
      timestamp: new Date().toISOString(),
      reliability: 0.9,
    }));

    logger.success('Data collected from documents', {
      query,
      documentCount: documents.length,
      resultCount: data.length,
      logType: 'success',
    });

    return data;
  } catch (error) {
    logger.error('Failed to collect data from documents', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query,
      logType: 'error',
    });
    throw error;
  }
}

