import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';
import { encrypt, decrypt } from '../../utils/encryption.js';

const router = Router();
const prisma = new PrismaClient();

// API 키 목록
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'listApiKeys',
      screenUrl: '/api/admin/api-keys',
    });

    try {
      const apiKeys = await prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          isActive: true,
          weight: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
        },
      });

      logger.success('API keys listed', {
        userId: req.userId,
        count: apiKeys.length,
        backendApiUrl: '/api/admin/api-keys',
        logType: 'success',
      });

      res.json({ apiKeys });
    } catch (error) {
      logger.error('API keys listing error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/api-keys',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  }
);

// API 키 생성
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'createApiKey',
      screenUrl: '/api/admin/api-keys',
    });

    try {
      const { provider, apiKey, weight, isActive } = req.body;

      if (!provider || !apiKey) {
        logger.warning('Invalid request: provider and apiKey are required', {
          userId: req.userId,
          backendApiUrl: '/api/admin/api-keys',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Provider and API key are required' });
        return;
      }

      // API 키 암호화
      const encryptedApiKey = encrypt(apiKey);

      const newApiKey = await prisma.apiKey.create({
        data: {
          provider,
          apiKey: encryptedApiKey,
          weight: weight || 1.0,
          isActive: isActive !== undefined ? isActive : true,
          createdBy: req.userId,
        },
        select: {
          id: true,
          provider: true,
          isActive: true,
          weight: true,
          createdAt: true,
        },
      });

      logger.success('API key created', {
        userId: req.userId,
        apiKeyId: newApiKey.id,
        provider,
        backendApiUrl: '/api/admin/api-keys',
        logType: 'success',
      });

      res.status(201).json({ apiKey: newApiKey });
    } catch (error) {
      logger.error('API key creation error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/api-keys',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
);

// API 키 수정
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'updateApiKey',
      screenUrl: '/api/admin/api-keys/:id',
    });

    try {
      const apiKeyId = parseInt(req.params.id);
      const { apiKey, weight, isActive } = req.body;

      const updateData: any = {};
      if (apiKey !== undefined) {
        // API 키 암호화
        updateData.apiKey = encrypt(apiKey);
      }
      if (weight !== undefined) updateData.weight = weight;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: updateData,
        select: {
          id: true,
          provider: true,
          isActive: true,
          weight: true,
          updatedAt: true,
        },
      });

      logger.success('API key updated', {
        userId: req.userId,
        apiKeyId,
        backendApiUrl: `/api/admin/api-keys/${apiKeyId}`,
        logType: 'success',
      });

      res.json({ apiKey: updated });
    } catch (error) {
      logger.error('API key update error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/admin/api-keys/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to update API key' });
    }
  }
);

// API 키 삭제
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'deleteApiKey',
      screenUrl: '/api/admin/api-keys/:id',
    });

    try {
      const apiKeyId = parseInt(req.params.id);

      await prisma.apiKey.delete({
        where: { id: apiKeyId },
      });

      logger.success('API key deleted', {
        userId: req.userId,
        apiKeyId,
        backendApiUrl: `/api/admin/api-keys/${apiKeyId}`,
        logType: 'success',
      });

      res.json({ message: 'API key deleted' });
    } catch (error) {
      logger.error('API key deletion error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/admin/api-keys/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  }
);

export default router;

