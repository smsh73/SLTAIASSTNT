import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '../../utils/logger.js';
import { decrypt } from '../../utils/encryption.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'GeminiClient',
});

let cachedClient: GoogleGenerativeAI | null = null;
let cachedKeyId: number | null = null;

export async function getGeminiClient(): Promise<GoogleGenerativeAI | null> {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        provider: 'gemini',
        isActive: true,
      },
      orderBy: {
        weight: 'desc',
      },
    });

    if (!apiKey) {
      logger.warning('Gemini API key not found', {
        logType: 'warning',
      });
      return null;
    }

    if (cachedClient && cachedKeyId === apiKey.id) {
      return cachedClient;
    }

    const decryptedApiKey = decrypt(apiKey.apiKey);
    cachedClient = new GoogleGenerativeAI(decryptedApiKey);
    cachedKeyId = apiKey.id;

    logger.info('Gemini client initialized', { logType: 'info' });

    return cachedClient;
  } catch (error) {
    logger.error('Failed to initialize Gemini client', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

export async function chatWithGemini(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number }
): Promise<string | null> {
  try {
    const gemini = await getGeminiClient();
    if (!gemini) {
      logger.warning('Gemini client not available', { logType: 'warning' });
      return null;
    }

    const modelName = options?.model || 'gemini-2.5-flash';
    logger.info('Gemini chat starting', {
      model: modelName,
      messageCount: messages.length,
      logType: 'info',
    });

    const model = gemini.getGenerativeModel({
      model: modelName,
    });

    const prompt = messages
      .map((m) => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        return `${role}: ${m.content}`;
      })
      .join('\n\n') + '\n\nAssistant:';

    const result = await model.generateContent({
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature || 0.7,
      },
    });

    const response = result.response;
    const text = response.text() || null;
    
    logger.info('Gemini chat response received', {
      hasContent: !!text,
      contentLength: text?.length || 0,
      logType: 'success',
    });

    return text;
  } catch (error: any) {
    logger.error('Gemini chat error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error?.message,
      logType: 'error',
    });
    return null;
  }
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export async function chatWithGeminiStream(
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
  options?: { model?: string; temperature?: number }
): Promise<void> {
  try {
    const gemini = await getGeminiClient();
    if (!gemini) {
      callbacks.onError(new Error('Gemini client not available'));
      return;
    }

    const modelName = options?.model || 'gemini-2.5-flash';
    logger.info('Gemini stream starting', {
      model: modelName,
      messageCount: messages.length,
      logType: 'info',
    });

    const model = gemini.getGenerativeModel({
      model: modelName,
    });

    const prompt = messages
      .map((m) => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        return `${role}: ${m.content}`;
      })
      .join('\n\n') + '\n\nAssistant:';

    let fullResponse = '';

    const result = await model.generateContentStream({
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature || 0.7,
      },
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        callbacks.onChunk(text);
      }
    }

    logger.info('Gemini stream completed', {
      responseLength: fullResponse.length,
      logType: 'success',
    });

    callbacks.onComplete(fullResponse);
  } catch (error: any) {
    logger.error('Gemini stream error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error?.message,
      logType: 'error',
    });
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

