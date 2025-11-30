import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validatePrompt } from '../services/guardrails/validator.js';
import { orchestrateAIStream } from '../services/ai/orchestrator-stream.js';
import { createLogger } from '../utils/logger.js';
import { aiSchemas } from '../utils/validation.js';
import { validateInput } from '../middleware/security.js';
import { createSession, addMessage, updateConversationTitle } from '../services/conversations/session.js';

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
      const { message, conversationId: existingConversationId, provider, chatMode: rawChatMode, mixOfAgents } = req.body;
      
      // X-Chat-Mode 헤더에서 chatMode 가져오기 (캐시 우회용)
      const headerChatMode = req.headers['x-chat-mode'] as string | undefined;
      
      // chatMode 결정: 헤더 우선 > body의 chatMode > mixOfAgents 레거시 지원
      let chatMode = headerChatMode || rawChatMode;
      if (!chatMode && mixOfAgents === true) {
        chatMode = 'mix';
      }
      if (!chatMode) {
        chatMode = 'normal';
      }

      logger.info('=== RAW REQUEST BODY ===', {
        rawBody: JSON.stringify(req.body),
        message: message?.substring(0, 50),
        provider,
        rawChatMode,
        headerChatMode,
        mixOfAgents,
        resolvedChatMode: chatMode,
        logType: 'info',
      });

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

      // 대화 ID 결정: 기존 대화가 없으면 새로 생성
      let activeConversationId = existingConversationId;
      let isNewConversation = false;
      
      if (!activeConversationId) {
        const title = message.length > 30 ? message.substring(0, 30) + '...' : message;
        const session = await createSession(req.userId!, title);
        activeConversationId = session.id;
        isNewConversation = true;
        logger.info('New conversation created', {
          userId: req.userId,
          conversationId: activeConversationId,
          logType: 'info',
        });
      }

      // 사용자 메시지 저장
      await addMessage(activeConversationId, req.userId!, 'user', message);

      // SSE 헤더 설정
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 새 대화인 경우 conversationId를 클라이언트에 전송
      if (isNewConversation) {
        res.write(`data: ${JSON.stringify({ type: 'conversationId', conversationId: activeConversationId })}\n\n`);
      }

      // 스트리밍 시작
      logger.info('Starting AI stream', {
        userId: req.userId,
        conversationId: activeConversationId,
        provider: provider || 'auto',
        chatMode: chatMode || 'normal',
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
          onComplete: async (fullResponse: string) => {
            // AI 응답 저장
            try {
              await addMessage(activeConversationId, req.userId!, 'assistant', fullResponse, provider || 'auto');
              logger.info('Conversation saved', {
                userId: req.userId,
                conversationId: activeConversationId,
                logType: 'success',
              });
            } catch (saveError) {
              logger.error('Failed to save AI response', {
                error: saveError instanceof Error ? saveError.message : 'Unknown',
                logType: 'error',
              });
            }
            res.write(`data: ${JSON.stringify({ type: 'complete', content: fullResponse, conversationId: activeConversationId })}\n\n`);
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
        },
        {
          preferredProvider: provider || undefined,
          chatMode: chatMode || 'normal',
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

