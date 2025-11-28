import axios from 'axios';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'LuxiaClient',
});

export async function getLuxiaApiKey(): Promise<string | null> {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        provider: 'luxia',
        isActive: true,
      },
      orderBy: {
        weight: 'desc',
      },
    });

    if (!apiKey) {
      logger.warning('Luxia API key not found', {
        logType: 'warning',
      });
      return null;
    }

    // API 키 복호화
    return decrypt(apiKey.apiKey);
  } catch (error) {
    logger.error('Failed to get Luxia API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

export async function chatWithLuxia(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number }
): Promise<string | null> {
  try {
    const apiKey = await getLuxiaApiKey();
    if (!apiKey) return null;

    // Luxia API 엔드포인트 (실제 엔드포인트로 변경 필요)
    const response = await axios.post(
      process.env.LUXIA_API_URL || 'https://api.luxia.com/v1/chat/completions',
      {
        model: options?.model || 'luxia-default',
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature || 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0]?.message?.content || null;
  } catch (error) {
    logger.error('Luxia chat error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

