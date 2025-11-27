import { orchestrateAI } from '../ai/orchestrator.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Workflow',
  callerFunction: 'WorkflowPlanner',
});

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: 'execute' | 'code' | 'table' | 'research';
  dependencies: string[];
  estimatedTime?: number;
}

export interface WorkflowPlan {
  steps: WorkflowStep[];
  estimatedTotalTime: number;
  requiredResources: string[];
}

export async function createWorkflowPlan(
  goal: string,
  context?: string
): Promise<WorkflowPlan> {
  try {
    const prompt = `다음 목표를 달성하기 위한 단계별 작업 계획을 수립해주세요:\n\n목표: ${goal}\n${context ? `\n컨텍스트:\n${context}` : ''}\n\n각 단계는 다음 형식으로 작성해주세요:\n- 단계명: 설명 (작업 유형: execute/code/table/research, 예상 소요 시간)`;

    const response = await orchestrateAI(
      [
        {
          role: 'system',
          content: '당신은 작업 계획 수립 전문가입니다. 목표를 달성하기 위한 단계별 계획을 수립합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      prompt
    );

    if (!response) {
      throw new Error('Failed to create workflow plan');
    }

    // 응답을 파싱하여 WorkflowPlan 생성
    const steps: WorkflowStep[] = [];
    const lines = response.split('\n').filter((line) => line.trim().length > 0);

    let stepId = 1;
    for (const line of lines) {
      if (line.includes('단계') || line.includes('Step') || line.startsWith('-')) {
        const cleanLine = line.replace(/^[-*•]\s*/, '');
        const parts = cleanLine.split(':');
        const name = parts[0].trim();
        const rest = parts.slice(1).join(':').trim();

        // 작업 유형 추출
        let action: WorkflowStep['action'] = 'execute';
        if (rest.includes('code') || rest.includes('코드')) {
          action = 'code';
        } else if (rest.includes('table') || rest.includes('표')) {
          action = 'table';
        } else if (rest.includes('research') || rest.includes('리서치')) {
          action = 'research';
        }

        const step: WorkflowStep = {
          id: `step-${stepId}`,
          name,
          description: rest,
          action,
          dependencies: stepId > 1 ? [`step-${stepId - 1}`] : [],
        };
        steps.push(step);
        stepId++;
      }
    }

    const plan: WorkflowPlan = {
      steps,
      estimatedTotalTime: steps.length * 5, // 임시: 각 단계당 5분
      requiredResources: ['ai', 'database'],
    };

    logger.success('Workflow plan created', {
      goal,
      stepCount: steps.length,
      logType: 'success',
    });

    return plan;
  } catch (error) {
    logger.error('Failed to create workflow plan', {
      error: error instanceof Error ? error.message : 'Unknown error',
      goal,
      logType: 'error',
    });
    throw error;
  }
}

