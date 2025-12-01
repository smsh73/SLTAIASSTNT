import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import { initSocketIO } from './utils/socket.js';
import { configureCORS, securityHeaders } from './middleware/security.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { validateEnvironment } from './utils/env-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  validateEnvironment();
} catch (error) {
  console.error('❌ 환경 변수 검증 실패:', error);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

const io = initSocketIO(server);

app.use(securityHeaders);
app.use(configureCORS());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(metricsMiddleware);

app.use('/api/', createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 500,
}));

app.use('/api/ai/', createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
}));

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.get('/health', async (req, res) => {
  try {
    const { checkDatabaseConnection } = await import('./utils/database.js');
    const dbConnected = await checkDatabaseConnection();
    
    res.json({
      status: dbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      websocket: io ? 'ready' : 'not initialized',
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

import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import aiStreamRoutes from './routes/ai-stream.js';
import aiWebsocketRoutes from './routes/ai-websocket.js';
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
app.use('/api/ai', aiWebsocketRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/multimodal', multimodalRoutes);
app.use('/metrics', metricsRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
if (process.env.NODE_ENV !== 'production') {
  app.use(notFoundHandler);
}
app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    screenName: 'Server',
    callerFunction: 'server.listen',
    logType: 'info',
  });
  logger.info('WebSocket server ready', {
    screenName: 'WebSocket',
    callerFunction: 'server.listen',
    logType: 'success',
  });
});
