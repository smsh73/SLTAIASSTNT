import { orchestrateAI } from '../ai/orchestrator.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Tables',
  callerFunction: 'TableGenerator',
});

export interface TableData {
  headers: string[];
  rows: string[][];
  title?: string;
}

export async function generateTable(
  prompt: string,
  context?: string
): Promise<TableData> {
  try {
    const fullPrompt = `다음 요청에 따라 표를 생성해주세요. 표는 JSON 형식으로 반환해주세요:\n\n요청: ${prompt}\n${context ? `\n컨텍스트:\n${context}` : ''}\n\n응답 형식:\n{\n  "title": "표 제목",\n  "headers": ["헤더1", "헤더2", ...],\n  "rows": [\n    ["값1", "값2", ...],\n    ...\n  ]\n}`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 표 생성 전문가입니다. 요청에 따라 구조화된 표 데이터를 JSON 형식으로 생성합니다.',
        },
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      fullPrompt
    );

    if (!response) {
      throw new Error('Failed to generate table');
    }

    // JSON 파싱 시도
    let tableData: TableData;
    try {
      // JSON 코드 블록에서 추출
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
      tableData = JSON.parse(jsonString);
    } catch (parseError) {
      // JSON 파싱 실패 시 기본 구조 생성
      logger.warning('Failed to parse table JSON, creating default structure', {
        logType: 'warning',
      });
      tableData = {
        title: '생성된 표',
        headers: ['항목', '값'],
        rows: [['데이터', response.substring(0, 100)]],
      };
    }

    logger.success('Table generated', {
      prompt: prompt.substring(0, 100),
      headerCount: tableData.headers.length,
      rowCount: tableData.rows.length,
      logType: 'success',
    });

    return tableData;
  } catch (error) {
    logger.error('Failed to generate table', {
      error: error instanceof Error ? error.message : 'Unknown error',
      prompt,
      logType: 'error',
    });
    throw error;
  }
}

export async function generateTableFromWebSearch(
  query: string,
  maxRows: number = 20
): Promise<TableData> {
  try {
    const prompt = `"${query}"에 대한 최신 통계 데이터를 검색하고 표 형식으로 정리해주세요. 최대 ${maxRows}개의 행을 포함해주세요.`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 웹 검색 및 데이터 정리 전문가입니다. 최신 통계 데이터를 검색하고 표 형식으로 정리합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to generate table from web search');
    }

    // 응답에서 표 데이터 추출
    const tableData = await generateTable(response);

    logger.success('Table generated from web search', {
      query,
      rowCount: tableData.rows.length,
      logType: 'success',
    });

    return tableData;
  } catch (error) {
    logger.error('Failed to generate table from web search', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query,
      logType: 'error',
    });
    throw error;
  }
}

