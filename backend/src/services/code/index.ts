import { getSetting, getSettingBoolean } from '../../routes/admin/settings.js';
import { executePythonCode as executeWithDocker, executeNotebook as executeNotebookDocker } from './executor.js';
import { executePythonCodeLocally, executeNotebookLocally, executeCodeLocally } from './localExecutor.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Code',
  callerFunction: 'CodeExecutionService',
});

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

export async function isCodeExecutionEnabled(): Promise<boolean> {
  return getSettingBoolean('CODE_EXECUTION_ENABLED');
}

export async function getExecutionMode(): Promise<'local' | 'docker'> {
  const mode = await getSetting('CODE_EXECUTION_MODE');
  return mode === 'docker' ? 'docker' : 'local';
}

export async function executePythonCode(
  code: string,
  timeout?: number
): Promise<ExecutionResult> {
  const enabled = await isCodeExecutionEnabled();
  if (!enabled) {
    logger.warning('Code execution is disabled', { logType: 'warning' });
    return {
      success: false,
      output: '',
      error: '코드 실행이 비활성화되어 있습니다. 관리자에게 문의하세요.',
      executionTime: 0,
    };
  }
  
  const mode = await getExecutionMode();
  
  logger.info('Executing Python code', {
    mode,
    timeout,
    logType: 'info',
  });

  if (mode === 'docker') {
    return executeWithDocker(code, timeout);
  } else {
    return executePythonCodeLocally(code, timeout);
  }
}

export async function executeCode(
  code: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const enabled = await isCodeExecutionEnabled();
  if (!enabled) {
    logger.warning('Code execution is disabled', { logType: 'warning' });
    return {
      success: false,
      output: '',
      error: '코드 실행이 비활성화되어 있습니다. 관리자에게 문의하세요.',
      executionTime: 0,
    };
  }
  
  const mode = await getExecutionMode();
  
  logger.info('Executing code', {
    mode,
    language: options.language || 'python',
    timeout: options.timeout,
    logType: 'info',
  });

  if (mode === 'docker' && options.language === 'python') {
    return executeWithDocker(code, options.timeout);
  } else {
    return executeCodeLocally(code, options);
  }
}

export async function executeNotebook(
  notebookJson: string,
  timeout?: number
): Promise<ExecutionResult> {
  const enabled = await isCodeExecutionEnabled();
  if (!enabled) {
    logger.warning('Code execution is disabled', { logType: 'warning' });
    return {
      success: false,
      output: '',
      error: '코드 실행이 비활성화되어 있습니다. 관리자에게 문의하세요.',
      executionTime: 0,
    };
  }
  
  const mode = await getExecutionMode();
  
  logger.info('Executing notebook', {
    mode,
    timeout,
    logType: 'info',
  });

  if (mode === 'docker') {
    return executeNotebookDocker(notebookJson, timeout);
  } else {
    return executeNotebookLocally(notebookJson, timeout);
  }
}

export { validateCode } from './validator.js';
export { validateCodeWithAST } from './astValidator.js';
export { generatePythonCode, generateNotebook } from './generator.js';
