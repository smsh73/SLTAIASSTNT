import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  createSession,
  getSession,
  listSessions,
} from '../services/conversations/session.js';
import { manageContext } from '../services/conversations/context.js';
import { createLogger } from '../utils/logger.js';

const router = Router();

// 대화 세션 생성
router.post(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Conversations',
      callerFunction: 'createConversation',
      screenUrl: '/api/conversations',
    });

    try {
      const { title, topic } = req.body;

      const session = await createSession(req.userId!, title, topic);

      logger.success('Conversation created', {
        userId: req.userId,
        conversationId: session.id,
        backendApiUrl: '/api/conversations',
        logType: 'success',
      });

      res.json({ conversation: session });
    } catch (error) {
      logger.error('Conversation creation error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/conversations',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }
);

// 대화 세션 목록
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Conversations',
      callerFunction: 'listConversations',
      screenUrl: '/api/conversations',
    });

    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const sessions = await listSessions(req.userId!, limit);

      logger.debug('Conversations listed', {
        userId: req.userId,
        count: sessions.length,
        backendApiUrl: '/api/conversations',
        logType: 'success',
      });

      res.json({ conversations: sessions });
    } catch (error) {
      logger.error('Conversation listing error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/conversations',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  }
);

// 대화 세션 조회
router.get(
  '/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Conversations',
      callerFunction: 'getConversation',
      screenUrl: '/api/conversations/:id',
    });

    try {
      const conversationId = parseInt(req.params.id);
      const session = await getSession(conversationId, req.userId!);

      if (!session) {
        logger.warning('Conversation not found', {
          userId: req.userId,
          conversationId,
          backendApiUrl: `/api/conversations/${conversationId}`,
          logType: 'warning',
        });
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      logger.debug('Conversation retrieved', {
        userId: req.userId,
        conversationId,
        messageCount: session.messages.length,
        backendApiUrl: `/api/conversations/${conversationId}`,
        logType: 'success',
      });

      res.json({ conversation: session });
    } catch (error) {
      logger.error('Conversation retrieval error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/conversations/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  }
);

// 컨텍스트 조회
router.get(
  '/:id/context',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Conversations',
      callerFunction: 'getContext',
      screenUrl: '/api/conversations/:id/context',
    });

    try {
      const conversationId = parseInt(req.params.id);
      const context = await manageContext(conversationId);

      logger.debug('Context retrieved', {
        userId: req.userId,
        conversationId,
        messageCount: context.length,
        backendApiUrl: `/api/conversations/${conversationId}/context`,
        logType: 'success',
      });

      res.json({ context });
    } catch (error) {
      logger.error('Context retrieval error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/conversations/${req.params.id}/context`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to get context' });
    }
  }
);

export default router;

