import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'MCP',
  callerFunction: 'MCPClient',
});

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPConnection {
  id: string;
  name: string;
  url: string;
  tools: MCPTool[];
  isActive: boolean;
}

class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();

  async connect(connection: Omit<MCPConnection, 'tools'>): Promise<MCPConnection> {
    try {
      // MCP 서버에 연결하고 도구 목록 가져오기
      const tools = await this.fetchTools(connection.url);

      const fullConnection: MCPConnection = {
        ...connection,
        tools,
        isActive: true,
      };

      this.connections.set(connection.id, fullConnection);

      logger.success('MCP connection established', {
        connectionId: connection.id,
        toolCount: tools.length,
        logType: 'success',
      });

      return fullConnection;
    } catch (error) {
      logger.error('Failed to connect to MCP server', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId: connection.id,
        logType: 'error',
      });
      throw error;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      this.connections.delete(connectionId);

      logger.success('MCP connection disconnected', {
        connectionId,
        logType: 'success',
      });
    }
  }

  async executeTool(
    connectionId: string,
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<any> {
    const connection = this.connections.get(connectionId);

    if (!connection || !connection.isActive) {
      throw new Error(`MCP connection ${connectionId} not found or inactive`);
    }

    const tool = connection.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      // MCP 서버에 도구 실행 요청
      const result = await this.callTool(connection.url, toolName, arguments_);

      logger.success('MCP tool executed', {
        connectionId,
        toolName,
        logType: 'success',
      });

      return result;
    } catch (error) {
      logger.error('MCP tool execution error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId,
        toolName,
        logType: 'error',
      });
      throw error;
    }
  }

  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  getConnection(connectionId: string): MCPConnection | undefined {
    return this.connections.get(connectionId);
  }

  private async fetchTools(url: string): Promise<MCPTool[]> {
    // MCP 서버에서 도구 목록 가져오기
    // 실제 구현은 MCP 프로토콜에 따라 다름
    try {
      const response = await fetch(`${url}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      logger.warning('Failed to fetch MCP tools, using empty list', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
        logType: 'warning',
      });
      return [];
    }
  }

  private async callTool(
    url: string,
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<any> {
    // MCP 서버에 도구 실행 요청
    try {
      const response = await fetch(`${url}/tools/${toolName}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arguments: arguments_ }),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute tool: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      logger.error('Failed to call MCP tool', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
        toolName,
        logType: 'error',
      });
      throw error;
    }
  }
}

export const mcpClient = new MCPClient();

