import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Code',
  callerFunction: 'ASTValidator',
});

interface ASTValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  ast?: any;
}

// 금지된 AST 노드 타입
const FORBIDDEN_NODE_TYPES = [
  'ImportDeclaration',
  'ImportExpression',
  'CallExpression',
  'MemberExpression',
];

// 금지된 함수/메서드 이름
const FORBIDDEN_FUNCTIONS = [
  'eval',
  'exec',
  'compile',
  '__import__',
  'open',
  'file',
  'input',
  'raw_input',
  'execfile',
  'reload',
  'getattr',
  'setattr',
  'delattr',
  'hasattr',
  '__builtins__',
  'globals',
  'locals',
  'vars',
  'dir',
];

// 금지된 모듈 이름
const FORBIDDEN_MODULES = [
  'os',
  'sys',
  'subprocess',
  'shutil',
  'ctypes',
  'socket',
  'urllib',
  'requests',
  'threading',
  'multiprocessing',
  'pickle',
  'marshal',
];

// 금지된 속성 접근
const FORBIDDEN_ATTRIBUTES = [
  '__class__',
  '__bases__',
  '__subclasses__',
  '__dict__',
  '__globals__',
  '__code__',
  '__func__',
  '__self__',
];

export function validateCodeWithAST(code: string): ASTValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Python 코드를 JavaScript AST로 파싱 (간단한 구현)
    // 실제로는 Python AST 파서를 사용해야 하지만, 여기서는 패턴 기반 검증 강화
    
    // AST 파싱 시도 (JavaScript로 파싱하여 구조 확인)
    let ast: any = null;
    try {
      // Python 코드는 JavaScript AST로 직접 파싱할 수 없으므로
      // 정규식 기반 패턴 매칭으로 보완
      ast = parsePythonLikeCode(code);
    } catch (parseError) {
      errors.push('코드 파싱 실패: 유효하지 않은 구문');
      return {
        isValid: false,
        errors,
        warnings,
      };
    }

    // AST 노드 순회 및 검증
    if (ast) {
      validateASTNode(ast, errors, warnings);
    }

    // 추가 정규식 기반 검증 (AST로 잡히지 않는 패턴)
    validatePatterns(code, errors, warnings);

    const result: ASTValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      ast: errors.length === 0 ? ast : undefined,
    };

    logger.debug('AST validation completed', {
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      logType: result.isValid ? 'success' : 'warning',
    });

    return result;
  } catch (error) {
    logger.error('AST validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return {
      isValid: false,
      errors: ['AST 검증 중 오류가 발생했습니다'],
      warnings: [],
    };
  }
}

function parsePythonLikeCode(code: string): any {
  // 간단한 Python 코드 구조 파싱
  // 실제로는 Python AST 파서 (ast 모듈)를 사용해야 함
  // 여기서는 기본 구조만 확인
  
  const lines = code.split('\n');
  const imports: string[] = [];
  const functionCalls: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // import 문 감지
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      const match = trimmed.match(/^(?:import|from)\s+(\w+)/);
      if (match) {
        imports.push(match[1]);
      }
    }
    
    // 함수 호출 감지
    const callMatch = trimmed.match(/(\w+)\(/);
    if (callMatch) {
      functionCalls.push(callMatch[1]);
    }
  }
  
  return {
    type: 'Program',
    imports,
    functionCalls,
    lines: lines.length,
  };
}

function validateASTNode(node: any, errors: string[], warnings: string[]): void {
  if (!node) return;

  // import 문 검증
  if (node.imports && Array.isArray(node.imports)) {
    for (const imp of node.imports) {
      if (FORBIDDEN_MODULES.includes(imp)) {
        errors.push(`금지된 모듈 import: ${imp}`);
      }
    }
  }

  // 함수 호출 검증
  if (node.functionCalls && Array.isArray(node.functionCalls)) {
    for (const func of node.functionCalls) {
      if (FORBIDDEN_FUNCTIONS.includes(func)) {
        errors.push(`금지된 함수 호출: ${func}`);
      }
    }
  }

  // 재귀적으로 자식 노드 검증
  if (node.body && Array.isArray(node.body)) {
    for (const child of node.body) {
      validateASTNode(child, errors, warnings);
    }
  }
}

function validatePatterns(code: string, errors: string[], warnings: string[]): void {
  // 위험한 패턴 검사
  const dangerousPatterns = [
    {
      pattern: /eval\s*\(/,
      message: 'eval() 함수 사용은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /exec\s*\(/,
      message: 'exec() 함수 사용은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /__import__\s*\(/,
      message: '__import__() 함수 사용은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /compile\s*\(/,
      message: 'compile() 함수 사용은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /open\s*\(\s*['"]\/etc\//,
      message: '시스템 디렉토리 접근은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /open\s*\(\s*['"]\/usr\//,
      message: '시스템 디렉토리 접근은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /open\s*\(\s*['"]\/bin\//,
      message: '시스템 디렉토리 접근은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /subprocess\.(call|run|Popen|check_call|check_output)/,
      message: 'subprocess 모듈 사용은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /os\.(system|popen|spawn|execv|execve)/,
      message: '시스템 명령 실행은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /socket\.(socket|create_connection)/,
      message: '네트워크 소켓 사용은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /requests\.(get|post|put|delete|patch)/,
      message: '외부 HTTP 요청은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /urllib\.(request|urlopen)/,
      message: 'urllib 모듈 사용은 금지되어 있습니다',
      severity: 'error' as const,
    },
    {
      pattern: /threading\.(Thread|Lock|Event)/,
      message: '스레딩 사용은 주의가 필요합니다',
      severity: 'warning' as const,
    },
    {
      pattern: /multiprocessing\.(Process|Pool)/,
      message: '멀티프로세싱 사용은 주의가 필요합니다',
      severity: 'warning' as const,
    },
  ];

  for (const { pattern, message, severity } of dangerousPatterns) {
    if (pattern.test(code)) {
      if (severity === 'error') {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  // 속성 접근 검증
  for (const attr of FORBIDDEN_ATTRIBUTES) {
    const attrPattern = new RegExp(`\\.${attr.replace(/__/g, '\\_\\_')}\\b`);
    if (attrPattern.test(code)) {
      errors.push(`금지된 속성 접근: ${attr}`);
    }
  }
}

