import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// 가드레일 목록
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'listGuardrails',
      screenUrl: '/api/admin/guardrails',
    });

    try {
      const guardrails = await prisma.guardrail.findMany({
        orderBy: { createdAt: 'desc' },
      });

      logger.success('Guardrails listed', {
        userId: req.userId,
        count: guardrails.length,
        backendApiUrl: '/api/admin/guardrails',
        logType: 'success',
      });

      res.json({ guardrails });
    } catch (error) {
      logger.error('Guardrails listing error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/guardrails',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to list guardrails' });
    }
  }
);

// 가드레일 생성
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'createGuardrail',
      screenUrl: '/api/admin/guardrails',
    });

    try {
      const { name, description, pattern, action, isActive } = req.body;

      if (!name || !pattern || !action) {
        logger.warning('Invalid request: name, pattern, and action are required', {
          userId: req.userId,
          backendApiUrl: '/api/admin/guardrails',
          logType: 'warning',
        });
        res.status(400).json({
          error: 'Name, pattern, and action are required',
        });
        return;
      }

      const guardrail = await prisma.guardrail.create({
        data: {
          name,
          description,
          pattern,
          action,
          isActive: isActive !== undefined ? isActive : true,
          createdBy: req.userId,
        },
      });

      logger.success('Guardrail created', {
        userId: req.userId,
        guardrailId: guardrail.id,
        backendApiUrl: '/api/admin/guardrails',
        logType: 'success',
      });

      res.status(201).json({ guardrail });
    } catch (error) {
      logger.error('Guardrail creation error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/guardrails',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to create guardrail' });
    }
  }
);

// 가드레일 수정
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'updateGuardrail',
      screenUrl: '/api/admin/guardrails/:id',
    });

    try {
      const guardrailId = parseInt(req.params.id);
      const { name, description, pattern, action, isActive } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (pattern !== undefined) updateData.pattern = pattern;
      if (action !== undefined) updateData.action = action;
      if (isActive !== undefined) updateData.isActive = isActive;

      const guardrail = await prisma.guardrail.update({
        where: { id: guardrailId },
        data: updateData,
      });

      logger.success('Guardrail updated', {
        userId: req.userId,
        guardrailId,
        backendApiUrl: `/api/admin/guardrails/${guardrailId}`,
        logType: 'success',
      });

      res.json({ guardrail });
    } catch (error) {
      logger.error('Guardrail update error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/admin/guardrails/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to update guardrail' });
    }
  }
);

// 가드레일 삭제
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'deleteGuardrail',
      screenUrl: '/api/admin/guardrails/:id',
    });

    try {
      const guardrailId = parseInt(req.params.id);

      await prisma.guardrail.delete({
        where: { id: guardrailId },
      });

      logger.success('Guardrail deleted', {
        userId: req.userId,
        guardrailId,
        backendApiUrl: `/api/admin/guardrails/${guardrailId}`,
        logType: 'success',
      });

      res.json({ message: 'Guardrail deleted' });
    } catch (error) {
      logger.error('Guardrail deletion error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/admin/guardrails/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to delete guardrail' });
    }
  }
);

export default router;

