import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../../middleware/auth.js';
import { getPrismaClient } from '../../utils/database.js';
import { hashPassword } from '../../utils/password.js';
import { createLogger } from '../../utils/logger.js';
import { validateInput } from '../../middleware/security.js';
import { adminSchemas } from '../../utils/validation.js';

const router = Router();
const prisma = getPrismaClient();

// 사용자 목록
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'listUsers',
      screenUrl: '/api/admin/users',
    });

    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      logger.success('Users listed', {
        userId: req.userId,
        count: users.length,
        backendApiUrl: '/api/admin/users',
        logType: 'success',
      });

      res.json({ users });
    } catch (error) {
      logger.error('Users listing error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/users',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to list users' });
    }
  }
);

// 사용자 생성
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'createUser',
      screenUrl: '/api/admin/users',
    });

    try {
      const { email, password, name, role } = req.body;

      if (!email || !password || !name) {
        logger.warning('Invalid request: email, password, and name are required', {
          userId: req.userId,
          backendApiUrl: '/api/admin/users',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Email, password, and name are required' });
        return;
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: role || 'user',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      logger.success('User created', {
        userId: req.userId,
        newUserId: user.id,
        backendApiUrl: '/api/admin/users',
        logType: 'success',
      });

      res.status(201).json({ user });
    } catch (error) {
      logger.error('User creation error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/admin/users',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// 사용자 수정
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'updateUser',
      screenUrl: '/api/admin/users/:id',
    });

    try {
      const userId = parseInt(req.params.id);
      const { email, password, name, role, isActive } = req.body;

      const updateData: any = {};
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password !== undefined) {
        updateData.passwordHash = await hashPassword(password);
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      logger.success('User updated', {
        userId: req.userId,
        targetUserId: userId,
        backendApiUrl: `/api/admin/users/${userId}`,
        logType: 'success',
      });

      res.json({ user });
    } catch (error) {
      logger.error('User update error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/admin/users/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// 사용자 삭제
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'Admin',
      callerFunction: 'deleteUser',
      screenUrl: '/api/admin/users/:id',
    });

    try {
      const userId = parseInt(req.params.id);

      await prisma.user.delete({
        where: { id: userId },
      });

      logger.success('User deleted', {
        userId: req.userId,
        targetUserId: userId,
        backendApiUrl: `/api/admin/users/${userId}`,
        logType: 'success',
      });

      res.json({ message: 'User deleted' });
    } catch (error) {
      logger.error('User deletion error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: `/api/admin/users/${req.params.id}`,
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

export default router;

