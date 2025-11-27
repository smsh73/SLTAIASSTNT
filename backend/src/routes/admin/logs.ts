import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// 로그 조회
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'listLogs',
      screenUrl: '/api/admin/logs',
    });

    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logType = req.query.logType as string;
      const userId = req.query.userId
        ? parseInt(req.query.userId as string)
        : undefined;

      const where: any = {};
      if (logType) where.logType = logType;
      if (userId) where.userId = userId;

      const [logs, total] = await Promise.all([
        prisma.log.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        }),
        prisma.log.count({ where }),
      ]);

      logger.success('Logs listed', {
        userId: req.userId,
        count: logs.length,
        total,
        backendApiUrl: '/api/admin/logs',
        logType: 'success',
      });

      res.json({ logs, total, limit, offset });
    } catch (error) {
      logger.error('Logs listing error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/logs',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to list logs' });
    }
  }
);

export default router;

