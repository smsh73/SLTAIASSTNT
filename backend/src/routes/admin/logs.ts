import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../../middleware/auth.js';
import { getPrismaClient } from '../../utils/database.js';
import { createLogger } from '../../utils/logger.js';

const router = Router();
const prisma = getPrismaClient();

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
      const keyword = req.query.keyword as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const screenName = req.query.screenName as string;
      const callerFunction = req.query.callerFunction as string;

      const where: any = {};
      if (logType) where.logType = logType;
      if (userId) where.userId = userId;
      if (screenName) where.screenName = { contains: screenName, mode: 'insensitive' };
      if (callerFunction) where.callerFunction = { contains: callerFunction, mode: 'insensitive' };
      
      if (keyword) {
        where.OR = [
          { message: { contains: keyword, mode: 'insensitive' } },
          { screenName: { contains: keyword, mode: 'insensitive' } },
          { callerFunction: { contains: keyword, mode: 'insensitive' } },
          { backendApiUrl: { contains: keyword, mode: 'insensitive' } },
        ];
      }
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

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

// 프롬프트 통계
router.get(
  '/stats/prompts',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'promptStats',
      screenUrl: '/api/admin/logs/stats/prompts',
    });

    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.createdAt.lte = end;
        }
      }

      const [
        totalMessages,
        userMessages,
        assistantMessages,
        providerStats,
        dailyStats,
        topUsers,
      ] = await Promise.all([
        prisma.message.count({ where: dateFilter }),
        prisma.message.count({ where: { ...dateFilter, role: 'user' } }),
        prisma.message.count({ where: { ...dateFilter, role: 'assistant' } }),
        prisma.message.groupBy({
          by: ['provider'],
          where: { ...dateFilter, role: 'assistant' },
          _count: { id: true },
        }),
        prisma.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) FILTER (WHERE role = 'user') as user_count,
            COUNT(*) FILTER (WHERE role = 'assistant') as assistant_count
          FROM messages
          WHERE created_at >= COALESCE(${startDate ? new Date(startDate) : null}::timestamp, created_at)
            AND created_at <= COALESCE(${endDate ? new Date(endDate + 'T23:59:59.999Z') : null}::timestamp, created_at)
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `,
        prisma.message.groupBy({
          by: ['userId'],
          where: { ...dateFilter, role: 'user' },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
      ]);

      const userIds = topUsers.map((u: any) => u.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });

      const topUsersWithNames = topUsers.map((u: any) => {
        const user = users.find((usr: any) => usr.id === u.userId);
        return {
          userId: u.userId,
          name: user?.name || user?.email || 'Unknown',
          count: u._count.id,
        };
      });

      res.json({
        totalMessages,
        userMessages,
        assistantMessages,
        providerStats: providerStats.map((p: any) => ({
          provider: p.provider || 'unknown',
          count: p._count.id,
        })),
        dailyStats,
        topUsers: topUsersWithNames,
      });
    } catch (error) {
      logger.error('Prompt stats error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/logs/stats/prompts',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to get prompt stats' });
    }
  }
);

// 로그 타입별 통계
router.get(
  '/stats/types',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          dateFilter.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.createdAt.lte = end;
        }
      }

      const typeStats = await prisma.log.groupBy({
        by: ['logType'],
        where: dateFilter,
        _count: { id: true },
      });

      const screenStats = await prisma.log.groupBy({
        by: ['screenName'],
        where: { ...dateFilter, screenName: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });

      res.json({
        typeStats: typeStats.map((t: any) => ({
          type: t.logType,
          count: t._count.id,
        })),
        screenStats: screenStats.map((s: any) => ({
          screen: s.screenName,
          count: s._count.id,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get log stats' });
    }
  }
);

export default router;

