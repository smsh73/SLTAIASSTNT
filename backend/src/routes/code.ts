import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateInput } from '../middleware/security.js';
import {
  generatePythonCode,
  generateNotebook,
} from '../services/code/generator.js';
import {
  executePythonCode,
  executeNotebook,
} from '../services/code/executor.js';
import { createLogger } from '../utils/logger.js';
import { codeSchemas } from '../utils/validation.js';

const router = Router();

/**
 * @swagger
 * /api/code/generate:
 *   post:
 *     tags: [Code]
 *     summary: Python 코드 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requirement
 *             properties:
 *               requirement:
 *                 type: string
 *               context:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [python, notebook]
 *     responses:
 *       200:
 *         description: 코드 생성 성공
 */
// 코드 생성
router.post(
  '/generate',
  authenticateToken,
  validateInput(codeSchemas.generate),
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Code',
      callerFunction: 'generateCode',
      screenUrl: '/api/code/generate',
    });

    try {
      const { requirement, context, type = 'python' } = req.body;

      if (!requirement) {
        logger.warning('Invalid request: requirement is required', {
          userId: req.userId,
          backendApiUrl: '/api/code/generate',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Requirement is required' });
        return;
      }

      let generatedCode;

      if (type === 'notebook') {
        generatedCode = await generateNotebook(requirement, context);
      } else {
        generatedCode = await generatePythonCode(requirement, context);
      }

      logger.success('Code generated', {
        userId: req.userId,
        type,
        backendApiUrl: '/api/code/generate',
        logType: 'success',
      });

      res.json({ code: generatedCode });
    } catch (error) {
      logger.error('Code generation error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/code/generate',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to generate code' });
    }
  }
);

/**
 * @swagger
 * /api/code/execute:
 *   post:
 *     tags: [Code]
 *     summary: Python 코드 실행
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [python, notebook]
 *               timeout:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 코드 실행 성공
 *       400:
 *         description: 코드 검증 실패
 */
// 코드 실행
router.post(
  '/execute',
  authenticateToken,
  validateInput(codeSchemas.execute),
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Code',
      callerFunction: 'executeCode',
      screenUrl: '/api/code/execute',
    });

    try {
      const { code, type = 'python', timeout } = req.body;

      if (!code) {
        logger.warning('Invalid request: code is required', {
          userId: req.userId,
          backendApiUrl: '/api/code/execute',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Code is required' });
        return;
      }

      let result;

      if (type === 'notebook') {
        result = await executeNotebook(code, timeout);
      } else {
        result = await executePythonCode(code, timeout);
      }

      logger.success('Code executed', {
        userId: req.userId,
        type,
        success: result.success,
        backendApiUrl: '/api/code/execute',
        logType: result.success ? 'success' : 'warning',
      });

      res.json({ result });
    } catch (error) {
      logger.error('Code execution error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/code/execute',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to execute code' });
    }
  }
);

export default router;

