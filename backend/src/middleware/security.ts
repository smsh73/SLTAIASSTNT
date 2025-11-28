import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({
  screenName: 'Security',
  callerFunction: 'SecurityMiddleware',
});

// CORS 설정 강화
export function configureCORS() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24시간

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  };
}

// 보안 헤더 추가
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
}

// 입력 검증 미들웨어
export function validateInput(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Zod 또는 Joi 스키마로 검증
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        logger.warning('Input validation failed', {
          errors: result.error.errors,
          backendApiUrl: req.originalUrl,
          logType: 'warning',
        });
        res.status(400).json({
          error: 'Validation failed',
          details: result.error.errors,
        });
        return;
      }

      req.body = result.data;
      next();
    } catch (error) {
      logger.error('Input validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: req.originalUrl,
        logType: 'error',
      });
      res.status(500).json({ error: 'Validation error' });
    }
  };
}

