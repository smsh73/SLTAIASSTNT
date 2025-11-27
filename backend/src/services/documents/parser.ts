import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Documents',
  callerFunction: 'DocumentParser',
});

export interface ParsedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
    [key: string]: any;
  };
}

export async function parseDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<ParsedDocument> {
  try {
    const extension = fileType.toLowerCase().split('.').pop() || '';

    switch (extension) {
      case 'pdf':
        return await parsePDF(fileBuffer);
      case 'docx':
      case 'doc':
        return await parseDOCX(fileBuffer);
      case 'xlsx':
      case 'xls':
        return await parseXLSX(fileBuffer);
      case 'txt':
        return await parseTXT(fileBuffer);
      default:
        logger.warning('Unsupported file type', {
          fileType,
          logType: 'warning',
        });
        return {
          text: '지원하지 않는 파일 형식입니다.',
          metadata: { fileType },
        };
    }
  } catch (error) {
    logger.error('Failed to parse document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileType,
      logType: 'error',
    });
    throw error;
  }
}

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  // PDF 파싱 (pdf-parse 라이브러리 필요)
  // 임시 구현
  return {
    text: 'PDF 파싱 기능은 pdf-parse 라이브러리를 설치해야 합니다.',
    metadata: {
      fileType: 'pdf',
      pageCount: 0,
    },
  };
}

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  // DOCX 파싱 (mammoth 또는 docx 라이브러리 필요)
  // 임시 구현
  return {
    text: 'DOCX 파싱 기능은 mammoth 라이브러리를 설치해야 합니다.',
    metadata: {
      fileType: 'docx',
      wordCount: 0,
    },
  };
}

async function parseXLSX(buffer: Buffer): Promise<ParsedDocument> {
  // XLSX 파싱 (xlsx 라이브러리 필요)
  // 임시 구현
  return {
    text: 'XLSX 파싱 기능은 xlsx 라이브러리를 설치해야 합니다.',
    metadata: {
      fileType: 'xlsx',
    },
  };
}

async function parseTXT(buffer: Buffer): Promise<ParsedDocument> {
  const text = buffer.toString('utf-8');
  const wordCount = text.split(/\s+/).length;

  return {
    text,
    metadata: {
      fileType: 'txt',
      wordCount,
    },
  };
}

