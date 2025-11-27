import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

