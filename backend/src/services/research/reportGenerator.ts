import { orchestrateAI } from '../ai/orchestrator.js';
import { collectDataFromWeb } from '../agents/dataCollector.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Research',
  callerFunction: 'ReportGenerator',
});

export interface ResearchReport {
  title: string;
  sections: {
    heading: string;
    content: string;
  }[];
  references?: string[];
  generatedAt: string;
}

export async function generateResearchReport(
  topic: string,
  requirements?: {
    sections?: string[];
    maxLength?: number;
    includeStatistics?: boolean;
  }
): Promise<ResearchReport> {
  try {
    logger.info('Starting research report generation', {
      topic,
      logType: 'info',
    });

    // 1. 데이터 수집
    const collectedData = await collectDataFromWeb(topic, 10);

    // 2. 보고서 구조 생성
    const sections = requirements?.sections || [
      '서론',
      '본론',
      '분석',
      '결론',
      '참고문헌',
    ];

    // 3. 각 섹션별 내용 생성
    const reportSections: ResearchReport['sections'] = [];

    for (const section of sections) {
      const sectionPrompt = `"${topic}"에 대한 리서치 보고서의 "${section}" 섹션을 작성해주세요. 다음 정보를 참고하세요:\n\n${collectedData.map((d) => d.data).join('\n\n')}`;

      const content = await orchestrateAI(
        [
          {
            role: 'system',
            content: '당신은 리서치 보고서 작성 전문가입니다. 체계적이고 전문적인 보고서를 작성합니다.',
          },
          {
            role: 'user',
            content: sectionPrompt,
          },
        ],
        sectionPrompt
      );

      if (content) {
        reportSections.push({
          heading: section,
          content: requirements?.maxLength
            ? content.substring(0, requirements.maxLength)
            : content,
        });
      }
    }

    // 4. 통계 포함 여부
    if (requirements?.includeStatistics) {
      const statsPrompt = `"${topic}"에 대한 주요 통계 데이터를 정리해주세요.`;

      const statsContent = await orchestrateAI(
        [
          {
            role: 'system',
            content: '당신은 통계 분석 전문가입니다. 데이터를 분석하고 통계를 정리합니다.',
          },
          {
            role: 'user',
            content: statsPrompt,
          },
        ],
        statsPrompt
      );

      if (statsContent) {
        reportSections.push({
          heading: '통계 분석',
          content: statsContent,
        });
      }
    }

    const report: ResearchReport = {
      title: `${topic} 리서치 보고서`,
      sections: reportSections,
      references: collectedData.map((d) => d.source),
      generatedAt: new Date().toISOString(),
    };

    logger.success('Research report generated', {
      topic,
      sectionCount: reportSections.length,
      logType: 'success',
    });

    return report;
  } catch (error) {
    logger.error('Failed to generate research report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      topic,
      logType: 'error',
    });
    throw error;
  }
}

