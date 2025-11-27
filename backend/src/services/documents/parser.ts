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
  try {
    // pdf-parse 라이브러리 사용
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule.default || pdfParseModule) as unknown as (buffer: Buffer) => Promise<any>;
    const data = await pdfParse(buffer);
    
    return {
      text: data.text,
      metadata: {
        fileType: 'pdf',
        pageCount: data.numpages,
        info: data.info,
      },
    };
  } catch (error) {
    logger.warning('PDF parsing failed, using fallback', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'warning',
    });
    return {
      text: 'PDF 파일을 파싱할 수 없습니다. pdf-parse 라이브러리가 필요합니다.',
      metadata: {
        fileType: 'pdf',
        pageCount: 0,
      },
    };
  }
}

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  try {
    // mammoth 라이브러리 사용
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      text: result.value,
      metadata: {
        fileType: 'docx',
        wordCount: result.value.split(/\s+/).length,
      },
    };
  } catch (error) {
    logger.warning('DOCX parsing failed, using fallback', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'warning',
    });
    return {
      text: 'DOCX 파일을 파싱할 수 없습니다. mammoth 라이브러리가 필요합니다.',
      metadata: {
        fileType: 'docx',
        wordCount: 0,
      },
    };
  }
}

async function parseXLSX(buffer: Buffer): Promise<ParsedDocument> {
  try {
    // xlsx 라이브러리 사용
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    let text = '';
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_txt(sheet);
      text += `\n[${sheetName}]\n${sheetText}\n`;
    });
    
    return {
      text: text.trim(),
      metadata: {
        fileType: 'xlsx',
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
      },
    };
  } catch (error) {
    logger.warning('XLSX parsing failed, using fallback', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'warning',
    });
    return {
      text: 'XLSX 파일을 파싱할 수 없습니다. xlsx 라이브러리가 필요합니다.',
      metadata: {
        fileType: 'xlsx',
      },
    };
  }
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

