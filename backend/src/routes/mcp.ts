import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  registerMCPConnection,
  listMCPConnections,
  executeMCPTool,
} from '../services/mcp/tools.js';
import { createLogger } from '../utils/logger.js';

const router = Router();

// MCP 연결 등록
router.post(
  '/connections',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'MCP',
      callerFunction: 'registerConnection',
      screenUrl: '/api/mcp/connections',
    });

    try {
      const { name, url } = req.body;

      if (!name || !url) {
        logger.warning('Invalid request: name and url are required', {
          userId: req.userId,
          backendApiUrl: '/api/mcp/connections',
          logType: 'warning',
        });
        res.status(400).json({ error: 'Name and URL are required' });
        return;
      }

      const connection = await registerMCPConnection(req.userId!, name, url);

      logger.success('MCP connection registered', {
        userId: req.userId,
        connectionId: connection.id,
        backendApiUrl: '/api/mcp/connections',
        logType: 'success',
      });

      res.json({ connection });
    } catch (error) {
      logger.error('MCP connection registration error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/mcp/connections',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to register MCP connection' });
    }
  }
);

// MCP 연결 목록
router.get(
  '/connections',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'MCP',
      callerFunction: 'listConnections',
      screenUrl: '/api/mcp/connections',
    });

    try {
      const connections = await listMCPConnections(req.userId!);

      logger.debug('MCP connections listed', {
        userId: req.userId,
        connectionCount: connections.length,
        backendApiUrl: '/api/mcp/connections',
        logType: 'success',
      });

      res.json({ connections });
    } catch (error) {
      logger.error('MCP connections listing error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/mcp/connections',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to list MCP connections' });
    }
  }
);

// MCP 도구 실행
router.post(
  '/tools/execute',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const logger = createLogger({
      screenName: 'MCP',
      callerFunction: 'executeTool',
      screenUrl: '/api/mcp/tools/execute',
    });

    try {
      const { connectionId, toolName, arguments: arguments_ } = req.body;

      if (!connectionId || !toolName) {
        logger.warning('Invalid request: connectionId and toolName are required', {
          userId: req.userId,
          backendApiUrl: '/api/mcp/tools/execute',
          logType: 'warning',
        });
        res.status(400).json({
          error: 'Connection ID and tool name are required',
        });
        return;
      }

      const result = await executeMCPTool(
        req.userId!,
        connectionId,
        toolName,
        arguments_ || {}
      );

      logger.success('MCP tool executed', {
        userId: req.userId,
        connectionId,
        toolName,
        backendApiUrl: '/api/mcp/tools/execute',
        logType: 'success',
      });

      res.json({ result });
    } catch (error) {
      logger.error('MCP tool execution error', {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        backendApiUrl: '/api/mcp/tools/execute',
        logType: 'error',
      });
      res.status(500).json({ error: 'Failed to execute MCP tool' });
    }
  }
);

export default router;

