import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../utils/database.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const prisma = getPrismaClient();

// 최근 로그 조회 (사용자용)
router.get(
  '/recent',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Logs',
      callerFunction: 'getRecentLogs',
      screenUrl: '/api/logs/recent',
    });

    try {
      const limit = parseInt(req.query.limit as string) || 50;

      const logs = await prisma.log.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      logger.debug('Recent logs retrieved', {
        userId: req.userId,
        count: logs.length,
        backendApiUrl: '/api/logs/recent',
        logType: 'success',
      });

      res.json(logs);
    } catch (error) {
      logger.error('Recent logs retrieval error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/logs/recent',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to get recent logs' });
    }
  }
);

export default router;

