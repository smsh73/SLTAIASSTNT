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
    let currentStep: Partial<WorkflowStep> | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 단계 시작 감지
      if (trimmedLine.match(/^\d+[\.\)]\s*|^[-*•]\s*|단계\s*\d+|Step\s*\d+/i)) {
        // 이전 단계 저장
        if (currentStep && currentStep.name) {
          steps.push(currentStep as WorkflowStep);
        }
        
        const cleanLine = trimmedLine.replace(/^\d+[\.\)]\s*|^[-*•]\s*|단계\s*\d+:|Step\s*\d+:/i, '');
        const parts = cleanLine.split(':');
        const name = parts[0].trim();
        const rest = parts.slice(1).join(':').trim();

        // 작업 유형 추출
        let action: WorkflowStep['action'] = 'execute';
        const lowerRest = rest.toLowerCase();
        if (lowerRest.includes('code') || lowerRest.includes('코드') || lowerRest.includes('python')) {
          action = 'code';
        } else if (lowerRest.includes('table') || lowerRest.includes('표') || lowerRest.includes('데이터표')) {
          action = 'table';
        } else if (lowerRest.includes('research') || lowerRest.includes('리서치') || lowerRest.includes('조사')) {
          action = 'research';
        }

        currentStep = {
          id: `step-${stepId}`,
          name,
          description: rest || name,
          action,
          dependencies: stepId > 1 ? [`step-${stepId - 1}`] : [],
        };
        stepId++;
      } else if (currentStep && trimmedLine.length > 0) {
        // 현재 단계의 설명에 추가
        currentStep.description += '\n' + trimmedLine;
      }
    }

    // 마지막 단계 저장
    if (currentStep && currentStep.name) {
      steps.push(currentStep as WorkflowStep);
    }

    // 단계가 없으면 기본 단계 생성
    if (steps.length === 0) {
      steps.push({
        id: 'step-1',
        name: '작업 실행',
        description: goal,
        action: 'execute',
        dependencies: [],
      });
    }

    // 각 단계의 예상 시간 계산 (실제 작업 유형에 따라)
    let totalTime = 0;
    for (const step of steps) {
      switch (step.action) {
        case 'code':
          totalTime += 3; // 코드 실행: 3분
          break;
        case 'table':
          totalTime += 2; // 표 생성: 2분
          break;
        case 'research':
          totalTime += 5; // 리서치: 5분
          break;
        default:
          totalTime += 2; // 일반 실행: 2분
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
