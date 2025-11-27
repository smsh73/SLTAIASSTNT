import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { createWorkflowPlan } from '../services/workflow/planner.js';
import { executeWorkflow } from '../services/workflow/engine.js';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// 워크플로우 생성
router.post(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Workflow',
      callerFunction: 'createWorkflow',
      screenUrl: '/api/workflows',
    });

    try {
      const { goal, context, conversationId } = req.body;

      if (!goal) {
        logger.warning('Invalid request: goal is required', {
          userId: req.userId,
          backendApiUrl: '/api/workflows',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Goal is required' });
        return;
      }

      // 워크플로우 계획 생성
      const plan = await createWorkflowPlan(goal, context);

      // 데이터베이스에 저장
      const workflow = await prisma.workflow.create({
        data: {
          userId: req.userId!,
          conversationId: conversationId ? parseInt(conversationId) : null,
          name: goal.substring(0, 255),
          plan: plan as any,
          status: 'pending',
        },
      });

      logger.success('Workflow created', {
        userId: req.userId,
        workflowId: workflow.id,
        stepCount: plan.steps.length,
        backendApiUrl: '/api/workflows',
        logType: 'success',
      });

      res.json({ workflow });
    } catch (error) {
      logger.error('Workflow creation error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/workflows',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  }
);

// 워크플로우 실행
router.post(
  '/:id/execute',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Workflow',
      callerFunction: 'executeWorkflow',
      screenUrl: '/api/workflows/:id/execute',
    });

    try {
      const workflowId = parseInt(req.params.id);

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.userId !== req.userId) {
        logger.warning('Workflow not found or unauthorized', {
          userId: req.userId,
          workflowId,
          backendApiUrl: `/api/workflows/${workflowId}/execute`,
          logType: 'warning',
        });
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }

      // 비동기 실행 (실제로는 작업 큐 사용 권장)
      executeWorkflow(workflowId).catch((error) => {
        logger.error('Workflow execution error (async)', {
          workflowId,
          error: error instanceof Error ? error.message : 'Unknown error',
          logType: 'error',
        });
      });

      logger.info('Workflow execution started', {
        userId: req.userId,
        workflowId,
        backendApiUrl: `/api/workflows/${workflowId}/execute`,
        logType: 'info',
      });

      res.json({ message: 'Workflow execution started', workflowId });
    } catch (error) {
      logger.error('Workflow execution error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/workflows/${req.params.id}/execute`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to execute workflow' });
    }
  }
);

// 워크플로우 상태 조회
router.get(
  '/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Workflow',
      callerFunction: 'getWorkflow',
      screenUrl: '/api/workflows/:id',
    });

    try {
      const workflowId = parseInt(req.params.id);

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.userId !== req.userId) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }

      logger.debug('Workflow retrieved', {
        userId: req.userId,
        workflowId,
        status: workflow.status,
        backendApiUrl: `/api/workflows/${workflowId}`,
        logType: 'success',
      });

      res.json({ workflow });
    } catch (error) {
      logger.error('Workflow retrieval error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/workflows/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to get workflow' });
    }
  }
);

export default router;

