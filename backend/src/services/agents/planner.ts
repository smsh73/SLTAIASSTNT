import { orchestrateAI } from '../ai/orchestrator.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Agents',
  callerFunction: 'Planner',
});

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: string;
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
    const prompt = `다음 목표를 달성하기 위한 단계별 작업 계획을 수립해주세요:\n\n목표: ${goal}\n${context ? `\n컨텍스트:\n${context}` : ''}\n\n각 단계는 다음 형식으로 작성해주세요:\n- 단계명: 설명 (예상 소요 시간, 필요한 리소스)`;

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
        const step: WorkflowStep = {
          id: `step-${stepId}`,
          name: line.replace(/^[-*•]\s*/, '').split(':')[0].trim(),
          description: line.split(':').slice(1).join(':').trim() || '',
          action: 'execute',
          dependencies: stepId > 1 ? [`step-${stepId - 1}`] : [],
        };
        steps.push(step);
        stepId++;
      }
    }

    // 각 단계의 예상 시간 계산
    let totalTime = 0;
    for (const step of steps) {
      switch (step.action) {
        case 'code':
          totalTime += 3;
          break;
        case 'table':
          totalTime += 2;
          break;
        case 'research':
          totalTime += 5;
          break;
        default:
          totalTime += 2;
      }
    }

    const plan: WorkflowPlan = {
      steps,
      estimatedTotalTime: totalTime,
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

