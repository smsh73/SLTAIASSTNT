import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '../../utils/logger.js';
import { validateCode } from './validator.js';
import { validateCodeWithAST } from './astValidator.js';
import { recordCodeExecution } from '../../utils/metrics.js';

const logger = createLogger({
  screenName: 'Code',
  callerFunction: 'LocalExecutor',
});

const TIMEOUT_MS = 30000;
const MAX_OUTPUT_SIZE = 1024 * 1024;
const MAX_CODE_LENGTH = 50000;

const DANGEROUS_PATTERNS = [
  /subprocess\s*\.\s*(?:call|run|Popen|check_output|getoutput)/i,
  /os\s*\.\s*(?:system|popen|spawn|exec|fork|kill|remove|unlink|rmdir|makedirs)/i,
  /shutil\s*\.\s*(?:rmtree|move|copy)/i,
  /open\s*\([^)]*['"]\s*\/(?!tmp)/i,
  /__import__\s*\(/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /compile\s*\(/i,
  /globals\s*\(\s*\)/i,
  /locals\s*\(\s*\)/i,
  /getattr\s*\(/i,
  /setattr\s*\(/i,
  /delattr\s*\(/i,
  /import\s+(?:ctypes|socket|urllib|requests|http|ftplib|telnetlib|smtplib|poplib|imaplib|nntplib)/i,
  /from\s+(?:ctypes|socket|urllib|requests|http|ftplib|telnetlib|smtplib|poplib|imaplib|nntplib)/i,
  /require\s*\(\s*['"](?:child_process|fs|net|http|https|dgram|cluster|os|vm|repl|readline)/i,
  /import\s*\(\s*['"](?:child_process|fs|net|http|https|dgram|cluster|os|vm|repl|readline)/i,
  /process\s*\.\s*(?:exit|kill|abort)/i,
  /\.execSync\s*\(/i,
  /\.spawnSync\s*\(/i,
];

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export interface ExecutionOptions {
  timeout?: number;
  language?: 'python' | 'javascript' | 'bash';
  allowNetwork?: boolean;
}

function validateSecurityPatterns(code: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (code.length > MAX_CODE_LENGTH) {
    errors.push(`코드가 너무 깁니다 (최대 ${MAX_CODE_LENGTH}자)`);
  }
  
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      errors.push('보안상 위험한 코드 패턴이 감지되었습니다');
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function executeCodeLocally(
  code: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const timeout = Math.min(options.timeout || TIMEOUT_MS, TIMEOUT_MS);
  const language = options.language || 'python';

  try {
    const securityValidation = validateSecurityPatterns(code);
    if (!securityValidation.isValid) {
      logger.warning('Security validation failed', {
        errors: securityValidation.errors,
        logType: 'warning',
      });
      return {
        success: false,
        output: '',
        error: `보안 검증 실패: ${securityValidation.errors.join(', ')}`,
        executionTime: Date.now() - startTime,
      };
    }
    
    const validation = validateCode(code);
    if (!validation.isValid) {
      logger.warning('Code validation failed', {
        errors: validation.errors,
        logType: 'warning',
      });
      return {
        success: false,
        output: '',
        error: `코드 검증 실패: ${validation.errors.join(', ')}`,
        executionTime: Date.now() - startTime,
      };
    }

    if (language === 'python') {
      const astValidation = validateCodeWithAST(code);
      if (!astValidation.isValid) {
        logger.warning('AST validation failed', {
          errors: astValidation.errors,
          logType: 'warning',
        });
        return {
          success: false,
          output: '',
          error: `AST 검증 실패: ${astValidation.errors.join(', ')}`,
          executionTime: Date.now() - startTime,
        };
      }
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-exec-'));
    let tempFile: string;
    let command: string;
    let args: string[];

    switch (language) {
      case 'python':
        tempFile = path.join(tempDir, 'script.py');
        command = 'python3';
        args = [tempFile];
        break;
      case 'javascript':
        tempFile = path.join(tempDir, 'script.js');
        command = 'node';
        args = [tempFile];
        break;
      case 'bash':
        tempFile = path.join(tempDir, 'script.sh');
        command = 'bash';
        args = [tempFile];
        break;
      default:
        return {
          success: false,
          output: '',
          error: `지원하지 않는 언어: ${language}`,
          executionTime: Date.now() - startTime,
        };
    }

    fs.writeFileSync(tempFile, code, 'utf8');

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const proc = spawn(command, args, {
        cwd: tempDir,
        timeout,
        env: {
          ...process.env,
          PATH: process.env.PATH,
          HOME: os.homedir(),
        },
      });

      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        proc.kill('SIGKILL');
        logger.warning('Code execution timeout', {
          timeout,
          logType: 'warning',
        });
      }, timeout);

      proc.stdout.on('data', (data: Buffer) => {
        if (stdout.length < MAX_OUTPUT_SIZE) {
          stdout += data.toString();
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        if (stderr.length < MAX_OUTPUT_SIZE) {
          stderr += data.toString();
        }
      });

      proc.on('close', (exitCode) => {
        clearTimeout(timeoutId);

        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
          logger.debug('Failed to cleanup temp dir', { logType: 'warning' });
        }

        const executionTime = Date.now() - startTime;

        if (isTimedOut) {
          recordCodeExecution(language, 'timeout', executionTime);
          resolve({
            success: false,
            output: stdout.trim(),
            error: `코드 실행이 타임아웃되었습니다 (${timeout}ms 초과)`,
            executionTime,
          });
          return;
        }

        const success = exitCode === 0 && stderr.length === 0;
        recordCodeExecution(language, success ? 'success' : 'error', executionTime);

        logger.success('Code execution completed', {
          language,
          executionTime,
          exitCode,
          hasError: stderr.length > 0,
          logType: success ? 'success' : 'warning',
        });

        resolve({
          success,
          output: stdout.trim(),
          error: stderr.length > 0 ? stderr.trim() : undefined,
          executionTime,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);

        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
        }

        const executionTime = Date.now() - startTime;
        recordCodeExecution(language, 'error', executionTime);

        logger.error('Process spawn error', {
          error: err.message,
          logType: 'error',
        });

        resolve({
          success: false,
          output: '',
          error: `프로세스 실행 오류: ${err.message}`,
          executionTime,
        });
      });
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error('Code execution error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
      logType: 'error',
    });

    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
    };
  }
}

export async function executePythonCodeLocally(
  code: string,
  timeout: number = TIMEOUT_MS
): Promise<ExecutionResult> {
  return executeCodeLocally(code, { timeout, language: 'python' });
}

export async function executeJavaScriptCodeLocally(
  code: string,
  timeout: number = TIMEOUT_MS
): Promise<ExecutionResult> {
  return executeCodeLocally(code, { timeout, language: 'javascript' });
}

export async function executeNotebookLocally(
  notebookJson: string,
  timeout: number = TIMEOUT_MS * 2
): Promise<ExecutionResult> {
  try {
    const notebook = JSON.parse(notebookJson);
    const cells = notebook.cells || [];

    let allOutput = '';
    let allErrors = '';
    let totalTime = 0;

    for (const cell of cells) {
      if (cell.cell_type === 'code') {
        const code = Array.isArray(cell.source)
          ? cell.source.join('\n')
          : cell.source;

        const result = await executePythonCodeLocally(code, timeout);
        totalTime += result.executionTime;

        allOutput += `[Cell ${cells.indexOf(cell) + 1}]\n${result.output}\n\n`;
        if (result.error) {
          allErrors += `[Cell ${cells.indexOf(cell) + 1}]\n${result.error}\n\n`;
        }
      }
    }

    logger.success('Notebook execution completed', {
      cellCount: cells.length,
      hasError: allErrors.length > 0,
      logType: allErrors.length > 0 ? 'warning' : 'success',
    });

    return {
      success: allErrors.length === 0,
      output: allOutput.trim(),
      error: allErrors.length > 0 ? allErrors.trim() : undefined,
      executionTime: totalTime,
    };
  } catch (error) {
    logger.error('Notebook execution error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });

    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: 0,
    };
  }
}
