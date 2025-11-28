import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { configureCORS, securityHeaders } from './middleware/security.js';
import { createRateLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 보안 미들웨어
app.use(securityHeaders);
app.use(configureCORS());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
import documentRoutes from './routes/documents.js';
import codeRoutes from './routes/code.js';
import workflowRoutes from './routes/workflows.js';
import mcpRoutes from './routes/mcp.js';
import conversationRoutes from './routes/conversations.js';
import logRoutes from './routes/logs.js';
import adminRoutes from './routes/admin/index.js';
import multimodalRoutes from './routes/multimodal.js';
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/multimodal', multimodalRoutes);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    screenName: 'Server',
    callerFunction: 'app.listen',
    logType: 'info',
  });
});

