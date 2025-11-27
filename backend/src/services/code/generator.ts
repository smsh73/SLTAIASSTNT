import { orchestrateAI } from '../ai/orchestrator.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Code',
  callerFunction: 'CodeGenerator',
});

export interface GeneratedCode {
  code: string;
  language: 'python' | 'notebook';
  description: string;
  dependencies?: string[];
}

export async function generatePythonCode(
  requirement: string,
  context?: string
): Promise<GeneratedCode> {
  try {
    const prompt = `다음 요구사항에 따라 Python 코드를 생성해주세요:\n\n요구사항: ${requirement}\n${context ? `\n컨텍스트:\n${context}` : ''}\n\n코드는 실행 가능해야 하며, 필요한 라이브러리는 import 문으로 포함해주세요.`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 Python 코드 생성 전문가입니다. 요구사항에 따라 실행 가능한 Python 코드를 생성합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to generate code');
    }

    // 코드 블록에서 추출
    const codeMatch = response.match(/```python\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);
    const code = codeMatch ? codeMatch[1] : response;

    // 의존성 추출
    const dependencies = extractDependencies(code);

    logger.success('Python code generated', {
      requirement: requirement.substring(0, 100),
      codeLength: code.length,
      dependencyCount: dependencies.length,
      logType: 'success',
    });

    return {
      code,
      language: 'python',
      description: requirement,
      dependencies,
    };
  } catch (error) {
    logger.error('Failed to generate Python code', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requirement,
      logType: 'error',
    });
    throw error;
  }
}

export async function generateNotebook(
  requirement: string,
  context?: string
): Promise<GeneratedCode> {
  try {
    const prompt = `다음 요구사항에 따라 Jupyter Notebook 형식의 코드를 생성해주세요:\n\n요구사항: ${requirement}\n${context ? `\n컨텍스트:\n${context}` : ''}\n\nNotebook은 여러 셀로 구성되어야 하며, 각 셀은 실행 가능해야 합니다.`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 Jupyter Notebook 생성 전문가입니다. 요구사항에 따라 구조화된 Notebook을 생성합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to generate notebook');
    }

    // Notebook JSON 형식으로 변환 (간단한 구현)
    const code = convertToNotebookFormat(response);

    logger.success('Notebook generated', {
      requirement: requirement.substring(0, 100),
      logType: 'success',
    });

    return {
      code,
      language: 'notebook',
      description: requirement,
    };
  } catch (error) {
    logger.error('Failed to generate notebook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requirement,
      logType: 'error',
    });
    throw error;
  }
}

function extractDependencies(code: string): string[] {
  const dependencies: string[] = [];
  const importRegex = /^import\s+(\w+)|^from\s+(\w+)\s+import/gm;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const dep = match[1] || match[2];
    if (dep && !dependencies.includes(dep)) {
      dependencies.push(dep);
    }
  }

  return dependencies;
}

function convertToNotebookFormat(content: string): string {
  // 코드 블록에서 실제 코드 추출
  const codeBlocks = content.match(/```python\n([\s\S]*?)\n```/g) || 
                     content.match(/```\n([\s\S]*?)\n```/g) ||
                     [content];
  
  const cells = codeBlocks.map((block, index) => {
    // 코드 블록에서 실제 코드 추출
    const codeMatch = block.match(/```(?:python)?\n([\s\S]*?)\n```/) || 
                      block.match(/```\n([\s\S]*?)\n```/);
    const code = codeMatch ? codeMatch[1] : block.replace(/```(?:python)?\n?/g, '').replace(/```\n?/g, '');
    
    return {
      cell_type: 'code',
      execution_count: null,
      metadata: {},
      source: code.split('\n').filter((line: string) => line.trim().length > 0),
      outputs: [],
    };
  });

  // 마크다운 셀도 추가 (설명용)
  const markdownCells = content.split(/\n{2,}/).filter((section) => {
    return !section.includes('```') && section.trim().length > 0;
  }).map((text) => ({
    cell_type: 'markdown',
    metadata: {},
    source: text.split('\n'),
  }));

  const allCells = [...markdownCells, ...cells];

  return JSON.stringify(
    {
      cells: allCells,
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          version: '3.11',
        },
      },
      nbformat: 4,
      nbformat_minor: 4,
    },
    null,
    2
  );
}

