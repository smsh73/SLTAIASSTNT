import Docker from 'dockerode';
import { createLogger } from '../../utils/logger.js';
import { validateCode } from './validator.js';

const logger = createLogger({
  screenName: 'Code',
  callerFunction: 'CodeExecutor',
});

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
});

const CONTAINER_IMAGE = 'saltlux-code-executor';
const TIMEOUT_MS = 30000; // 30초

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export async function executePythonCode(
  code: string,
  timeout: number = TIMEOUT_MS
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // 코드 검증
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

    // 컨테이너 생성 및 실행 (보안 강화)
    const container = await docker.createContainer({
      Image: CONTAINER_IMAGE,
      Cmd: ['python', '-c', code],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        AutoRemove: true,
        Memory: 512 * 1024 * 1024, // 512MB
        MemorySwap: 512 * 1024 * 1024, // Swap 비활성화
        CpuQuota: 50000, // 50% CPU
        CpuPeriod: 100000,
        CpuShares: 512,
        NetworkMode: 'none', // 네트워크 비활성화
        ReadonlyRootfs: true, // 읽기 전용 루트 파일 시스템
        CapDrop: ['ALL'], // 모든 권한 제거
        CapAdd: [], // 권한 추가 없음
        SecurityOpt: ['no-new-privileges:true'],
        PidsLimit: 50, // 프로세스 수 제한
        Ulimits: [
          { Name: 'nofile', Soft: 1024, Hard: 1024 },
          { Name: 'nproc', Soft: 50, Hard: 50 },
        ],
      },
      WorkingDir: '/tmp',
      User: '1000:1000', // 비특권 사용자
    });

    await container.start();

    // 출력 수집
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });

    let output = '';
    let errorOutput = '';

    const timeoutId = setTimeout(async () => {
      try {
        await container.stop();
        logger.warning('Code execution timeout', {
          logType: 'warning',
        });
      } catch (err) {
        // 컨테이너가 이미 종료되었을 수 있음
      }
    }, timeout);

    return new Promise((resolve) => {
      let buffer = Buffer.alloc(0);

      stream.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      stream.on('end', async () => {
        clearTimeout(timeoutId);
        const result = buffer.toString('utf-8');
        const lines = result.split('\n');

        for (const line of lines) {
          if (line.startsWith('STDOUT:')) {
            output += line.substring(7) + '\n';
          } else if (line.startsWith('STDERR:')) {
            errorOutput += line.substring(7) + '\n';
          } else {
            output += line + '\n';
          }
        }

        try {
          await container.stop();
          await container.remove();
        } catch (err) {
          // 컨테이너가 이미 제거되었을 수 있음
        }

        const executionTime = Date.now() - startTime;

        logger.success('Code execution completed', {
          executionTime,
          hasError: errorOutput.length > 0,
          logType: errorOutput.length > 0 ? 'warning' : 'success',
        });

        resolve({
          success: errorOutput.length === 0,
          output: output.trim(),
          error: errorOutput.length > 0 ? errorOutput.trim() : undefined,
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

export async function executeNotebook(
  notebookJson: string,
  timeout: number = TIMEOUT_MS * 2
): Promise<ExecutionResult> {
  try {
    // Notebook JSON 파싱
    const notebook = JSON.parse(notebookJson);
    const cells = notebook.cells || [];

    let allOutput = '';
    let allErrors = '';

    // 각 셀을 순차적으로 실행
    for (const cell of cells) {
      if (cell.cell_type === 'code') {
        const code = Array.isArray(cell.source)
          ? cell.source.join('\n')
          : cell.source;

        const result = await executePythonCode(code, timeout);

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
      executionTime: 0, // 전체 실행 시간은 각 셀의 합
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

