import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';
import { WorkflowPlan, WorkflowStep } from './planner.js';
import { orchestrateAI } from '../ai/orchestrator.js';
import { executePythonCode } from '../code/executor.js';
import { generateTable } from '../tables/generator.js';
import { generateResearchReport } from '../research/reportGenerator.js';

const prisma = new PrismaClient();
const logger = createLogger({
  screenName: 'Workflow',
  callerFunction: 'WorkflowEngine',
});

export interface WorkflowExecution {
  workflowId: number;
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  results: Record<string, any>;
  errors: Record<string, string>;
}

export async function executeWorkflow(
  workflowId: number
): Promise<WorkflowExecution> {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const plan = workflow.plan as unknown as WorkflowPlan;
    const execution: WorkflowExecution = {
      workflowId,
      currentStep: workflow.currentStep,
      status: 'running',
      results: {},
      errors: {},
    };

    // 워크플로우 상태 업데이트
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        status: 'running',
      },
    });

    logger.info('Workflow execution started', {
      workflowId,
      stepCount: plan.steps.length,
      logType: 'info',
    });

    // 각 단계 실행
    for (let i = workflow.currentStep; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      try {
        logger.info('Executing workflow step', {
          workflowId,
          stepId: step.id,
          stepName: step.name,
          logType: 'info',
        });

        // 의존성 확인
        const dependenciesMet = step.dependencies.every(
          (depId) => execution.results[depId] !== undefined
        );

        if (!dependenciesMet) {
          throw new Error(`Dependencies not met for step ${step.id}`);
        }

        // 단계 실행
        const stepResult = await executeStep(step, execution.results);

        execution.results[step.id] = stepResult;

        // 진행 상황 업데이트
        await prisma.workflow.update({
          where: { id: workflowId },
          data: {
            currentStep: i + 1,
            results: execution.results,
          },
        });

        logger.success('Workflow step completed', {
          workflowId,
          stepId: step.id,
          logType: 'success',
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        execution.errors[step.id] = errorMessage;
        execution.status = 'failed';

        logger.error('Workflow step failed', {
          workflowId,
          stepId: step.id,
          error: errorMessage,
          logType: 'error',
        });

        // 워크플로우 상태 업데이트
        await prisma.workflow.update({
          where: { id: workflowId },
          data: {
            status: 'failed',
            results: execution.results,
          },
        });

        break;
      }
    }

    // 모든 단계 완료
    if (execution.status === 'running' && Object.keys(execution.errors).length === 0) {
      execution.status = 'completed';

      await prisma.workflow.update({
        where: { id: workflowId },
        data: {
          status: 'completed',
          results: execution.results,
        },
      });

      logger.success('Workflow execution completed', {
        workflowId,
        stepCount: plan.steps.length,
        logType: 'success',
      });
    }

    return execution;
  } catch (error) {
    logger.error('Workflow execution error', {
      workflowId,
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });

    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        status: 'failed',
      },
    });

    throw error;
  }
}

async function executeStep(
  step: WorkflowStep,
  previousResults: Record<string, any>
): Promise<any> {
  switch (step.action) {
    case 'execute':
      // AI 기반 작업 실행
      return await executeAITask(step, previousResults);

    case 'code':
      // 코드 실행
      return await executeCodeTask(step, previousResults);

    case 'table':
      // 표 생성
      return await executeTableTask(step, previousResults);

    case 'research':
      // 리서치
      return await executeResearchTask(step, previousResults);

    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

async function executeAITask(
  step: WorkflowStep,
  previousResults: Record<string, any>
): Promise<string> {
  const context = Object.values(previousResults)
    .map((r) => (typeof r === 'string' ? r : JSON.stringify(r)))
    .join('\n\n');

  const response = await orchestrateAI(
    [
      {
        role: 'system',
        content: '당신은 작업 실행 전문가입니다. 주어진 작업을 수행합니다.',
      },
      {
        role: 'user',
        content: `${step.description}\n\n이전 단계 결과:\n${context}`,
      },
    ],
    step.description
  );

  return response || '';
}

async function executeCodeTask(
  step: WorkflowStep,
  previousResults: Record<string, any>
): Promise<any> {
  // 코드 생성 및 실행
  const code = step.description; // 실제로는 코드 생성 필요
  const result = await executePythonCode(code);
  return result.output;
}

async function executeTableTask(
  step: WorkflowStep,
  previousResults: Record<string, any>
): Promise<any> {
  const context = Object.values(previousResults)
    .map((r) => (typeof r === 'string' ? r : JSON.stringify(r)))
    .join('\n\n');

  const table = await generateTable(step.description, context);
  return table;
}

async function executeResearchTask(
  step: WorkflowStep,
  previousResults: Record<string, any>
): Promise<any> {
  const report = await generateResearchReport(step.description);
  return report;
}

