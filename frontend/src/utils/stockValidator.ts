/**
 * 종목코드/종목명 검증 및 정정 유틸리티
 */

export interface StockInfo {
  stockCode?: string;
  stockName?: string;
  isValid: boolean;
  corrected?: {
    stockCode?: string;
    stockName?: string;
  };
}

/**
 * 입력 텍스트에서 종목코드와 종목명을 추출하고 검증
 * @param input 사용자 입력 텍스트
 * @returns 검증된 종목 정보
 */
export function validateAndCorrectStock(input: string): StockInfo {
  const trimmed = input.trim();
  
  // 6자리 숫자 패턴 (종목코드)
  const stockCodePattern = /\b(\d{6})\b/g;
  const codeMatches = trimmed.match(stockCodePattern);
  
  // 한글 종목명 패턴 (2-10자 한글)
  const stockNamePattern = /[가-힣]{2,10}/g;
  const nameMatches = trimmed.match(stockNamePattern);
  
  let stockCode: string | undefined;
  let stockName: string | undefined;
  
  // 종목코드 추출
  if (codeMatches && codeMatches.length > 0) {
    stockCode = codeMatches[0];
  }
  
  // 종목명 추출 (일반적인 종목명 패턴)
  if (nameMatches && nameMatches.length > 0) {
    // 가장 긴 한글 문자열을 종목명으로 선택
    stockName = nameMatches.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    );
  }
  
  // 종목코드나 종목명 중 하나라도 있으면 유효
  const isValid = !!(stockCode || stockName);
  
  // 종목코드 정정 (앞뒤 공백 제거, 0으로 시작하는 경우 처리)
  let correctedCode: string | undefined;
  if (stockCode) {
    correctedCode = stockCode.padStart(6, '0');
  }
  
  // 종목명 정정 (공백 제거, 불필요한 문자 제거)
  let correctedName: string | undefined;
  if (stockName) {
    correctedName = stockName.trim();
  }
  
  return {
    stockCode: correctedCode || stockCode,
    stockName: correctedName || stockName,
    isValid,
    corrected: (correctedCode || correctedName) ? {
      stockCode: correctedCode,
      stockName: correctedName,
    } : undefined,
  };
}

/**
 * 종목코드 형식 검증 (6자리 숫자)
 */
export function isValidStockCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * 종목명 형식 검증 (2-10자 한글)
 */
export function isValidStockName(name: string): boolean {
  return /^[가-힣]{2,10}$/.test(name);
}

