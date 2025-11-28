import { createLogger } from '../../utils/logger.js';
import { WorkflowPlan, WorkflowStep } from './planner.js';
import { orchestrateAI } from '../ai/orchestrator.js';
import { executePythonCode } from '../code/executor.js';
import { generateTable } from '../tables/generator.js';
import { generateResearchReport } from '../research/reportGenerator.js';
import { generatePythonCode } from '../code/generator.js';
import { getPrismaClient } from '../../utils/database.js';
import { recordWorkflow } from '../../utils/metrics.js';
import { notificationManager } from '../notifications/manager.js';

const prisma = getPrismaClient();
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

async function executeStep(
  step: WorkflowStep,
  previousResults: Record<string, any>
): Promise<any> {
  logger.info('Executing workflow step', {
    stepId: step.id,
    action: step.action,
    logType: 'info',
  });

  switch (step.action) {
    case 'ai_chat':
      return await orchestrateAI(
        [
          {
            role: 'system',
            content: step.description || '',
          },
          {
            role: 'user',
            content: step.input || '',
          },
        ],
        step.input || '',
        {
          fallbackProviders: step.fallbacks,
        }
      );

    case 'generate_code':
      const code = await generatePythonCode(
        step.requirement || '',
        JSON.stringify(previousResults)
      );
      return code.code;

    case 'execute_code':
      return await executePythonCode(step.code || '');

    case 'generate_table':
      return await generateTable(step.requirement || '', previousResults);

    case 'generate_report':
      return await generateResearchReport(
        step.requirement || '',
        previousResults
      );

    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

export async function executeWorkflow(
  workflowId: number
): Promise<WorkflowExecution> {
  // 트랜잭션으로 워크플로우 실행
  return await prisma.$transaction(async (tx) => {
    try {
      const workflow = await tx.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // 워크플로우 상태를 running으로 업데이트
      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      const plan = workflow.plan as unknown as WorkflowPlan;

      const execution: WorkflowExecution = {
        workflowId,
        currentStep: 0,
        status: 'running',
        results: {},
        errors: {},
      };

      // 각 단계 실행
      for (const step of plan.steps) {
        execution.currentStep++;

        // 의존성 확인
        if (step.dependencies && step.dependencies.length > 0) {
          const missingDeps = step.dependencies.filter(
            (dep) => !execution.results[dep]
          );
          if (missingDeps.length > 0) {
            throw new Error(`Dependencies not met for step ${step.id}: ${missingDeps.join(', ')}`);
          }
        }

        try {
          const stepResult = await executeStep(step, execution.results);
          execution.results[step.id] = stepResult;

          // 중간 결과 저장
          await tx.workflow.update({
            where: { id: workflowId },
            data: {
              currentStep: execution.currentStep,
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

          // 재시도 로직 (최대 3회)
          const maxRetries = 3;
          let retryCount = 0;
          let stepSucceeded = false;

          while (retryCount < maxRetries && !stepSucceeded) {
            try {
              logger.info('Retrying workflow step', {
                workflowId,
                stepId: step.id,
                retryCount: retryCount + 1,
                logType: 'info',
              });

              // 지수 백오프: 1초, 2초, 4초
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));

              const retryResult = await executeStep(step, execution.results);
              execution.results[step.id] = retryResult;
              stepSucceeded = true;
              
              // 에러 제거
              delete execution.errors[step.id];

              // 중간 결과 저장
              await tx.workflow.update({
                where: { id: workflowId },
                data: {
                  currentStep: execution.currentStep,
                  results: execution.results,
                },
              });

              logger.success('Workflow step succeeded after retry', {
                workflowId,
                stepId: step.id,
                retryCount: retryCount + 1,
                logType: 'success',
              });
            } catch (retryError) {
              retryCount++;
              if (retryCount >= maxRetries) {
                execution.status = 'failed';
                logger.error('Workflow step failed after retries', {
                  workflowId,
                  stepId: step.id,
                  error: retryError instanceof Error ? retryError.message : 'Unknown error',
                  retryCount,
                  logType: 'error',
                });

                // 워크플로우 상태 업데이트
                await tx.workflow.update({
                  where: { id: workflowId },
                  data: {
                    status: 'failed',
                    results: execution.results,
                    errors: execution.errors,
                  },
                });
                
                // 메트릭 기록
                recordWorkflow('failed');
                
                // 알림 전송
                await notificationManager.sendWorkflowNotification(
                  workflowId,
                  'failed',
                  `워크플로우 실행 실패: ${errorMessage}`
                );
                
                break;
              }
            }
          }

          if (!stepSucceeded) {
            break;
          }
        }
      }

      // 모든 단계 완료
      if (execution.status === 'running' && Object.keys(execution.errors).length === 0) {
        execution.status = 'completed';

        await tx.workflow.update({
          where: { id: workflowId },
          data: {
            status: 'completed',
            results: execution.results,
            completedAt: new Date(),
          },
        });

        // 메트릭 기록
        recordWorkflow('completed');
        
        // 알림 전송
        await notificationManager.sendWorkflowNotification(
          workflowId,
          'completed',
          `워크플로우가 성공적으로 완료되었습니다. 총 ${Object.keys(execution.results).length}개 단계 실행.`
        );

        logger.success('Workflow execution completed', {
          workflowId,
          stepCount: plan.steps.length,
          logType: 'success',
        });
      } else if (execution.status === 'failed') {
        // 실패 시 상태 업데이트
        await tx.workflow.update({
          where: { id: workflowId },
          data: {
            status: 'failed',
            results: execution.results,
            errors: execution.errors,
          },
        });

        // 메트릭 기록
        recordWorkflow('failed');
        
        // 알림 전송
        await notificationManager.sendWorkflowNotification(
          workflowId,
          'failed',
          `워크플로우 실행 실패: ${Object.keys(execution.errors).length}개 단계에서 오류 발생`
        );
      }

      return execution;
    } catch (error) {
      // 트랜잭션 내부 에러는 자동 롤백
      logger.error('Workflow execution error', {
        workflowId,
        error: error instanceof Error ? error.message : 'Unknown error',
        logType: 'error',
      });
      
      // 워크플로우 상태를 실패로 업데이트 (트랜잭션 외부)
      try {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: {
            status: 'failed',
          },
        });
      } catch (updateError) {
        // 무시
      }
      
      throw error;
    }
  });
}
