import { orchestrateAI } from '../ai/orchestrator.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Agents',
  callerFunction: 'DocumentAgent',
});

export interface DocumentAnalysis {
  summary: string;
  statistics?: {
    wordCount: number;
    pageCount?: number;
    keyTopics: string[];
  };
  insights?: string[];
}

export async function summarizeDocument(
  documentText: string,
  maxLength: number = 500
): Promise<string> {
  try {
    const prompt = `다음 문서를 ${maxLength}자 이내로 요약해주세요:\n\n${documentText.substring(0, 10000)}`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 문서 요약 전문가입니다. 핵심 내용을 간결하고 명확하게 요약합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to generate summary');
    }

    logger.success('Document summarized', {
      originalLength: documentText.length,
      summaryLength: response.length,
      logType: 'success',
    });

    return response;
  } catch (error) {
    logger.error('Failed to summarize document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    throw error;
  }
}

export async function analyzeDocumentStatistics(
  documentText: string
): Promise<DocumentAnalysis['statistics']> {
  try {
    const wordCount = documentText.split(/\s+/).length;
    const sentences = documentText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = documentText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    // 키 토픽 추출
    const prompt = `다음 문서의 주요 주제 5개를 추출해주세요:\n\n${documentText.substring(0, 5000)}`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 문서 분석 전문가입니다. 문서의 주요 주제를 추출합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    const keyTopics = response
      ? response
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .slice(0, 5)
          .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      : [];

    logger.success('Document statistics calculated', {
      wordCount,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      topicCount: keyTopics.length,
      logType: 'success',
    });

    return {
      wordCount,
      keyTopics,
    };
  } catch (error) {
    logger.error('Failed to analyze document statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    throw error;
  }
}

export async function generateDocumentFromContent(
  sourceText: string,
  instruction: string
): Promise<string> {
  try {
    const prompt = `다음 내용을 기반으로 ${instruction}:\n\n원본 내용:\n${sourceText.substring(0, 10000)}`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 문서 작성 전문가입니다. 주어진 내용을 바탕으로 새로운 문서를 작성합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to generate document');
    }

    logger.success('Document generated from content', {
      sourceLength: sourceText.length,
      generatedLength: response.length,
      logType: 'success',
    });

    return response;
  } catch (error) {
    logger.error('Failed to generate document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    throw error;
  }
}

