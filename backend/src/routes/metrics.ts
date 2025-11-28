import { Router, Request, Response } from 'express';
import { register } from '../utils/metrics.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Prometheus 메트릭 엔드포인트
router.get('/', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 관리자용 메트릭 조회 (JSON 형식)
router.get(
  '/json',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const metrics = await register.getMetricsAsJSON();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;

