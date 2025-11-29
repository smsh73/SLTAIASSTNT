import axios from 'axios';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'LuxiaClient',
});

const LUXIA_API_URL = 'https://bridge.luxiacloud.com/luxia/v1/chat';
const DEFAULT_MODEL = 'luxia3-llm-32b-0731';

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

    return decrypt(apiKey.apiKey);
  } catch (error) {
    logger.error('Failed to get Luxia API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

export interface LuxiaOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  stream?: boolean;
}

export async function chatWithLuxia(
  messages: Array<{ role: string; content: string }>,
  options?: LuxiaOptions
): Promise<string | null> {
  try {
    const apiKey = await getLuxiaApiKey();
    if (!apiKey) return null;

    const response = await axios.post(
      LUXIA_API_URL,
      {
        model: options?.model || DEFAULT_MODEL,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        temperature: options?.temperature ?? 0,
        max_completion_tokens: options?.maxTokens || 2048,
        top_p: options?.topP ?? 1,
        frequency_penalty: options?.frequencyPenalty ?? 0,
      },
      {
        headers: {
          apikey: apiKey,
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

export async function streamLuxia(
  messages: Array<{ role: string; content: string }>,
  options?: LuxiaOptions
): Promise<NodeJS.ReadableStream | null> {
  try {
    const apiKey = await getLuxiaApiKey();
    if (!apiKey) return null;

    const response = await axios.post(
      LUXIA_API_URL,
      {
        model: options?.model || DEFAULT_MODEL,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        temperature: options?.temperature ?? 0,
        max_completion_tokens: options?.maxTokens || 2048,
        top_p: options?.topP ?? 1,
        frequency_penalty: options?.frequencyPenalty ?? 0,
      },
      {
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Luxia stream error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

