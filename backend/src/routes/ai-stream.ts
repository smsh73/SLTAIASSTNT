import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validatePrompt } from '../services/guardrails/validator.js';
import { orchestrateAIStream } from '../services/ai/orchestrator-stream.js';
import { createLogger } from '../utils/logger.js';
import { aiSchemas } from '../utils/validation.js';
import { validateInput } from '../middleware/security.js';

const router = Router();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'AIStreamRoutes',
});

/**
 * @swagger
 * /api/ai/chat/stream:
 *   post:
 *     tags: [AI]
 *     summary: AI 채팅 (스트리밍)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               conversationId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 스트리밍 응답 (text/event-stream)
 *       401:
 *         description: 인증 필요
 */
router.post(
  '/chat/stream',
  authenticateToken,
  validateInput(aiSchemas.chat),
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'AI',
      callerFunction: 'streamChat',
      screenUrl: '/api/ai/chat/stream',
    });

    try {
      const { message, conversationId } = req.body;

      // 프롬프트 검증
      const validation = await validatePrompt(message);
      if (!validation.isValid) {
        logger.warning('Prompt validation failed', {
          userId: req.userId,
          backendApiUrl: '/api/ai/chat/stream',
          logType: 'warning',
        });
        res.status(400).json({ error: validation.message || 'Prompt blocked' });
        return;
      }

      // SSE 헤더 설정
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Nginx 버퍼링 비활성화

      // 스트리밍 시작
      logger.info('Starting AI stream', {
        userId: req.userId,
        conversationId,
        logType: 'info',
      });

      await orchestrateAIStream(
        [
          {
            role: 'user',
            content: message,
          },
        ],
        message,
        {
          onChunk: (chunk: string) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          },
          onComplete: (fullResponse: string) => {
            res.write(`data: ${JSON.stringify({ type: 'complete', content: fullResponse })}\n\n`);
            res.end();
          },
          onError: (error: Error) => {
            logger.error('Stream error', {
              userId: req.userId,
              error: error.message,
              logType: 'error',
            });
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
          },
        }
      );
    } catch (error) {
      logger.error('Stream chat error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        logType: 'error',
      });
      res.status(500).json({ error: 'Stream failed' });
    }
  }
);

export default router;

