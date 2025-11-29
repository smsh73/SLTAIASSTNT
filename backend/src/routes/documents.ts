import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { uploadToLocalStorage } from '../services/storage/localStorage.js';
import { parseDocument } from '../services/documents/parser.js';
import {
  summarizeDocument,
  analyzeDocumentStatistics,
  generateDocumentFromContent,
} from '../services/agents/documentAgent.js';
import { getPrismaClient } from '../utils/database.js';
import { createLogger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = getPrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Documents',
      callerFunction: 'uploadDocument',
      screenUrl: '/api/documents/upload',
    });

    try {
      if (!req.file) {
        logger.warning('No file uploaded', {
          userId: req.userId,
          backendApiUrl: '/api/documents/upload',
          logType: 'warning',
        });
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { conversationId } = req.body;
      const file = req.file;
      const fileKey = `documents/${req.userId}/${uuidv4()}-${file.originalname}`;

      const fileUrl = await uploadToLocalStorage(file.buffer, fileKey, file.mimetype);

      const parsed = await parseDocument(file.buffer, file.originalname);

      const document = await prisma.document.create({
        data: {
          userId: req.userId!,
          conversationId: conversationId ? parseInt(conversationId) : null,
          name: file.originalname,
          type: file.mimetype,
          size: BigInt(file.size),
          s3Key: fileKey,
          s3Url: fileUrl,
          metadata: { ...parsed.metadata, text: parsed.text },
        },
      });

      logger.success('Document uploaded', {
        userId: req.userId,
        documentId: document.id,
        filename: file.originalname,
        backendApiUrl: '/api/documents/upload',
        logType: 'success',
      });

      res.json({
        document: {
          id: document.id,
          filename: document.name,
          fileType: document.type,
          url: fileUrl,
          parsedText: parsed.text,
        },
      });
    } catch (error) {
      logger.error('Document upload error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/documents/upload',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

// 문서 요약
router.post(
  '/:id/summarize',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Documents',
      callerFunction: 'summarizeDocument',
      screenUrl: '/api/documents/:id/summarize',
    });

    try {
      const documentId = parseInt(req.params.id);
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document || document.userId !== req.userId) {
        logger.warning('Document not found or unauthorized', {
          userId: req.userId,
          documentId,
          backendApiUrl: `/api/documents/${documentId}/summarize`,
          logType: 'warning',
        });
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // 문서 텍스트 가져오기 (실제로는 S3에서 다운로드 필요)
      const documentText = (document.metadata as any)?.text || '';

      const summary = await summarizeDocument(documentText);

      logger.success('Document summarized', {
        userId: req.userId,
        documentId,
        backendApiUrl: `/api/documents/${documentId}/summarize`,
        logType: 'success',
      });

      res.json({ summary });
    } catch (error) {
      logger.error('Document summarization error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/documents/${req.params.id}/summarize`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to summarize document' });
    }
  }
);

// 문서 통계 분석
router.post(
  '/:id/statistics',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Documents',
      callerFunction: 'analyzeDocumentStatistics',
      screenUrl: '/api/documents/:id/statistics',
    });

    try {
      const documentId = parseInt(req.params.id);
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document || document.userId !== req.userId) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const documentText = (document.metadata as any)?.text || '';
      const statistics = await analyzeDocumentStatistics(documentText);

      logger.success('Document statistics analyzed', {
        userId: req.userId,
        documentId,
        backendApiUrl: `/api/documents/${documentId}/statistics`,
        logType: 'success',
      });

      res.json({ statistics });
    } catch (error) {
      logger.error('Document statistics error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/documents/${req.params.id}/statistics`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to analyze statistics' });
    }
  }
);

// 문서 기반 새 문서 생성
router.post(
  '/:id/generate',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Documents',
      callerFunction: 'generateDocumentFromContent',
      screenUrl: '/api/documents/:id/generate',
    });

    try {
      const documentId = parseInt(req.params.id);
      const { instruction } = req.body;

      if (!instruction) {
        res.status(400).json({ error: 'Instruction is required' });
        return;
      }

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document || document.userId !== req.userId) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const documentText = (document.metadata as any)?.text || '';
      const generatedContent = await generateDocumentFromContent(
        documentText,
        instruction
      );

      logger.success('Document generated from content', {
        userId: req.userId,
        documentId,
        backendApiUrl: `/api/documents/${documentId}/generate`,
        logType: 'success',
      });

      res.json({ content: generatedContent });
    } catch (error) {
      logger.error('Document generation error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/documents/${req.params.id}/generate`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to generate document' });
    }
  }
);

export default router;

