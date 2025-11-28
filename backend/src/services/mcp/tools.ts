import { mcpClient, MCPConnection } from './client.js';
import { createLogger } from '../../utils/logger.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
const logger = createLogger({
  screenName: 'MCP',
  callerFunction: 'MCPTools',
});

export async function registerMCPConnection(
  userId: number,
  name: string,
  url: string
): Promise<MCPConnection> {
  try {
    const connectionId = `mcp-${Date.now()}`;
    const connection = await mcpClient.connect({
      id: connectionId,
      name,
      url,
      isActive: false,
    });

    // 데이터베이스에 저장 (필요한 경우)
    // await prisma.mcpConnection.create({ ... });

    logger.success('MCP connection registered', {
      userId,
      connectionId: connection.id,
      logType: 'success',
    });

    return connection;
  } catch (error) {
    logger.error('Failed to register MCP connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      logType: 'error',
    });
    throw error;
  }
}

export async function listMCPConnections(
  userId: number
): Promise<MCPConnection[]> {
  try {
    const connections = mcpClient.getConnections();

    logger.debug('MCP connections listed', {
      userId,
      connectionCount: connections.length,
      logType: 'success',
    });

    return connections;
  } catch (error) {
    logger.error('Failed to list MCP connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      logType: 'error',
    });
    return [];
  }
}

export async function executeMCPTool(
  userId: number,
  connectionId: string,
  toolName: string,
  arguments_: Record<string, any>
): Promise<any> {
  try {
    const result = await mcpClient.executeTool(connectionId, toolName, arguments_);

    logger.success('MCP tool executed', {
      userId,
      connectionId,
      toolName,
      logType: 'success',
    });

    return result;
  } catch (error) {
    logger.error('Failed to execute MCP tool', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      connectionId,
      toolName,
      logType: 'error',
    });
    throw error;
  }
}

