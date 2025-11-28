import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/password.js';
import { createLogger } from '../utils/logger.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateInput } from '../middleware/security.js';
import { authSchemas } from '../utils/validation.js';

const router = Router();
const prisma = new PrismaClient();

// Register
router.post('/register', validateInput(authSchemas.register), async (req: Request, res: Response) => {
  const logger = createLogger({
    screenName: 'Auth',
    callerFunction: 'register',
    screenUrl: '/api/auth/register',
  });

  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      logger.warning('Registration failed: Missing fields', {
        backendApiUrl: '/api/auth/register',
        logType: 'warning',
      });
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      logger.warning('Registration failed: Email already exists', {
        backendApiUrl: '/api/auth/register',
        logType: 'warning',
      });
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'user',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const token = generateToken(user.id);

    logger.success('User registered successfully', {
      userId: user.id,
      backendApiUrl: '/api/auth/register',
      logType: 'success',
    });

    res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    logger.error('Registration error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      backendApiUrl: '/api/auth/register',
      logType: 'error',
    });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', validateInput(authSchemas.login), async (req: Request, res: Response) => {
  const logger = createLogger({
    screenName: 'Auth',
    callerFunction: 'login',
    screenUrl: '/api/auth/login',
  });

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      logger.warning('Login failed: Missing credentials', {
        backendApiUrl: '/api/auth/login',
        logType: 'warning',
      });
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      logger.warning('Login failed: Invalid credentials or inactive user', {
        backendApiUrl: '/api/auth/login',
        logType: 'warning',
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      logger.warning('Login failed: Invalid password', {
        backendApiUrl: '/api/auth/login',
        logType: 'warning',
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id);

    logger.success('User logged in successfully', {
      userId: user.id,
      backendApiUrl: '/api/auth/login',
      logType: 'success',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    logger.error('Login error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      backendApiUrl: '/api/auth/login',
      logType: 'error',
    });
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const logger = createLogger({
    screenName: 'Auth',
    callerFunction: 'getMe',
    screenUrl: '/api/auth/me',
  });

  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    logger.debug('User info retrieved', {
      userId: req.user.id,
      backendApiUrl: '/api/auth/me',
      logType: 'success',
    });

    res.json({ user: req.user });
  } catch (error) {
    logger.error('Get user error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.userId,
      backendApiUrl: '/api/auth/me',
      logType: 'error',
    });
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

function generateToken(userId: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, secret, {
    expiresIn,
  } as jwt.SignOptions);
}

export default router;

