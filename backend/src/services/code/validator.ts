import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Code',
  callerFunction: 'CodeValidator',
});

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const FORBIDDEN_PATTERNS = [
  /import\s+os\s*$/m,
  /import\s+subprocess/m,
  /import\s+sys\s*$/m,
  /import\s+shutil/m,
  /import\s+ctypes/m,
  /eval\(/,
  /exec\(/,
  /__import__/,
  /compile\(/,
  /open\(['"]\/etc\//,
  /open\(['"]\/usr\//,
  /open\(['"]\/bin\//,
  /open\(['"]\/var\//,
  /open\(['"]\/home\//,
  /rm\s+-rf/,
  /rm\s+-r/,
  /delete\s+/,
  /drop\s+table/i,
  /socket\./,
  /urllib/,
  /requests\.(get|post|put|delete)\(/,
  /subprocess\.(call|run|Popen)/,
  /os\.(system|popen|spawn)/,
  /shutil\.(rmtree|copytree)/,
  /ctypes\./,
  /__builtins__/,
  /globals\(\)/,
  /locals\(\)/,
  /vars\(\)/,
  /dir\(\)/,
];

const WARNING_PATTERNS = [
  /import\s+requests/m,
  /urllib/,
  /socket/,
  /threading/,
  /multiprocessing/,
];

export function validateCode(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 금지된 패턴 검사
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`금지된 패턴이 발견되었습니다: ${pattern}`);
    }
  }

  // 경고 패턴 검사
  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push(`주의가 필요한 패턴이 발견되었습니다: ${pattern}`);
    }
  }

  // 기본 구문 검사 (간단한 구현)
  const openBrackets = (code.match(/\(/g) || []).length;
  const closeBrackets = (code.match(/\)/g) || []).length;
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  const openSquare = (code.match(/\[/g) || []).length;
  const closeSquare = (code.match(/\]/g) || []).length;

  if (openBrackets !== closeBrackets) {
    errors.push('괄호가 일치하지 않습니다');
  }
  if (openBraces !== closeBraces) {
    errors.push('중괄호가 일치하지 않습니다');
  }
  if (openSquare !== closeSquare) {
    errors.push('대괄호가 일치하지 않습니다');
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  logger.debug('Code validation completed', {
    isValid: result.isValid,
    errorCount: errors.length,
    warningCount: warnings.length,
    logType: result.isValid ? 'success' : 'warning',
  });

  return result;
}

