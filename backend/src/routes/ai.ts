import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { generateSuggestions } from '../services/promptSuggestion.js';
import { orchestrateAI } from '../services/ai/orchestrator.js';
import { validatePrompt } from '../services/guardrails/validator.js';
import { getPrismaClient } from '../utils/database.js';
import { createLogger } from '../utils/logger.js';
import { validateInput } from '../middleware/security.js';
import { aiSchemas } from '../utils/validation.js';

const prisma = getPrismaClient();

const router = Router();

/**
 * @swagger
 * /api/ai/prompt-suggestions:
 *   post:
 *     tags: [AI]
 *     summary: 프롬프트 제안 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - words
 *             properties:
 *               words:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 프롬프트 제안 목록
 *       401:
 *         description: 인증 필요
 */
// 프롬프트 제안
router.post(
  '/prompt-suggestions',
  authenticateToken,
  validateInput(aiSchemas.promptSuggestions),
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'AI',
      callerFunction: 'getPromptSuggestions',
      screenUrl: '/api/ai/prompt-suggestions',
    });

    try {
      const { words } = req.body;

      if (!Array.isArray(words)) {
        logger.warning('Invalid request: words must be an array', {
          userId: req.userId,
          backendApiUrl: '/api/ai/prompt-suggestions',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Words must be an array' });
        return;
      }

      const suggestions = await generateSuggestions(words);

      logger.debug('Prompt suggestions generated', {
        userId: req.userId,
        wordCount: words.length,
        suggestionCount: suggestions.length,
        backendApiUrl: '/api/ai/prompt-suggestions',
        logType: 'success',
      });

      res.json({ suggestions });
    } catch (error) {
      logger.error('Failed to generate prompt suggestions', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/ai/prompt-suggestions',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to generate suggestions' });
    }
  }
);

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: AI 채팅
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
 *         description: AI 응답
 *       401:
 *         description: 인증 필요
 */
// 채팅
router.post(
  '/chat',
  authenticateToken,
  validateInput(aiSchemas.chat),
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'AI',
      callerFunction: 'chat',
      screenUrl: '/api/ai/chat',
    });

    try {
      const { message, conversationId } = req.body;

      if (!message) {
        logger.warning('Invalid request: message is required', {
          userId: req.userId,
          backendApiUrl: '/api/ai/chat',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // 프롬프트 가드레일 검증
      const validation = await validatePrompt(message);
      if (!validation.isValid) {
        logger.warning('Prompt blocked by guardrail', {
          userId: req.userId,
          message: validation.message,
          backendApiUrl: '/api/ai/chat',
          logType: 'warning',
        });
        res.status(400).json({ error: validation.message || 'Prompt blocked' });
        return;
      }

      // 수정된 프롬프트 사용
      const finalMessage = validation.modifiedPrompt || message;

      // 대화 이력 로드
      let conversation = null;
      let historyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

      if (conversationId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: parseInt(conversationId) },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 20, // 최근 20개 메시지만 사용
            },
          },
        });

        if (conversation) {
          historyMessages = conversation.messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          }));
        }
      }

      // 사용자 메시지 추가
      historyMessages.push({
        role: 'user',
        content: finalMessage,
      });

      // AI 오케스트레이션으로 응답 생성
      const aiResponse = await orchestrateAI(historyMessages, finalMessage);

      if (!aiResponse) {
        logger.error('Failed to generate AI response', {
          userId: req.userId,
          backendApiUrl: '/api/ai/chat',
          logType: 'error',
        });
        res.status(500).json({ error: 'Failed to generate response' });
        return;
      }

      // 대화 저장
      let finalConversationId = conversationId
        ? parseInt(conversationId)
        : null;

      if (!finalConversationId) {
        const newConversation = await prisma.conversation.create({
          data: {
            userId: req.userId!,
            title: message.substring(0, 100),
            topic: 'general',
          },
        });
        finalConversationId = newConversation.id;
      }

      // 메시지 저장
      await prisma.message.createMany({
        data: [
          {
            conversationId: finalConversationId,
            role: 'user',
            content: finalMessage,
          },
          {
            conversationId: finalConversationId,
            role: 'assistant',
            content: aiResponse,
          },
        ],
      });

      logger.success('Chat response generated', {
        userId: req.userId,
        conversationId: finalConversationId,
        backendApiUrl: '/api/ai/chat',
        logType: 'success',
      });

      res.json({
        content: aiResponse,
        conversationId: finalConversationId,
      });
    } catch (error) {
      logger.error('Chat error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/ai/chat',
        logType: 'error',
      });
      res.status(500).json({ error: 'Chat failed' });
    }
  }
);

export default router;

