import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import { configureCORS, securityHeaders } from './middleware/security.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { validateEnvironment } from './utils/env-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 검증 (애플리케이션 시작 전)
try {
  validateEnvironment();
} catch (error) {
  console.error('❌ 환경 변수 검증 실패:', error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// 보안 미들웨어
app.use(securityHeaders);
app.use(configureCORS());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 메트릭 미들웨어
app.use(metricsMiddleware);

// Rate limiting
app.use('/api/', createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15분
  maxRequests: 100, // 기본 제한
}));

// AI API는 더 엄격한 제한
app.use('/api/ai/', createRateLimiter({
  windowMs: 60 * 1000, // 1분
  maxRequests: 20,
}));

// Serve uploaded files
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// Health check
app.get('/health', async (req, res) => {
  try {
    const { checkDatabaseConnection } = await import('./utils/database.js');
    const dbConnected = await checkDatabaseConnection();
    
    res.json({
      status: dbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Routes
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import aiStreamRoutes from './routes/ai-stream.js';
import documentRoutes from './routes/documents.js';
import codeRoutes from './routes/code.js';
import workflowRoutes from './routes/workflows.js';
import mcpRoutes from './routes/mcp.js';
import conversationRoutes from './routes/conversations.js';
import logRoutes from './routes/logs.js';
import adminRoutes from './routes/admin/index.js';
import multimodalRoutes from './routes/multimodal.js';
import metricsRoutes from './routes/metrics.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger.js';
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai', aiStreamRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/multimodal', multimodalRoutes);
app.use('/metrics', metricsRoutes);

// Swagger API 문서
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendBuildPath));
  
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/metrics') || req.path.startsWith('/api-docs') || req.path === '/health') {
      next();
    } else {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    }
  });
}

// 에러 핸들러 (모든 라우트 이후에 위치)
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
if (process.env.NODE_ENV !== 'production') {
  app.use(notFoundHandler);
}
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    screenName: 'Server',
    callerFunction: 'app.listen',
    logType: 'info',
  });
});

