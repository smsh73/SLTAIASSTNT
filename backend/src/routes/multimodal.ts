import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { processMultimodalInput } from '../services/multimodal/processor.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 멀티모달 처리
router.post(
  '/process',
  authenticateToken,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Multimodal',
      callerFunction: 'processMultimodal',
      screenUrl: '/api/multimodal/process',
    });

    try {
      const { type, prompt } = req.body;

      if (!type) {
        logger.warning('Invalid request: type is required', {
          userId: req.userId,
          backendApiUrl: '/api/multimodal/process',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Type is required' });
        return;
      }

      let input: any;

      if (type === 'text') {
        const { text } = req.body;
        if (!text) {
          res.status(400).json({ error: 'Text is required for text type' });
          return;
        }
        input = {
          type: 'text',
          content: text,
        };
      } else {
        if (!req.file) {
          res.status(400).json({ error: 'File is required' });
          return;
        }

        input = {
          type,
          content: req.file.buffer,
          mimeType: req.file.mimetype,
        };
      }

      const output = await processMultimodalInput(input, prompt);

      logger.success('Multimodal input processed', {
        userId: req.userId,
        inputType: type,
        outputType: output.type,
        backendApiUrl: '/api/multimodal/process',
        logType: 'success',
      });

      res.json({ output });
    } catch (error) {
      logger.error('Multimodal processing error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/multimodal/process',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to process multimodal input' });
    }
  }
);

export default router;

