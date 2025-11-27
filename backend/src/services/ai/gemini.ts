import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';

const prisma = new PrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'GeminiClient',
});

let client: GoogleGenerativeAI | null = null;

export async function getGeminiClient(): Promise<GoogleGenerativeAI | null> {
  if (client) return client;

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

    client = new GoogleGenerativeAI(apiKey.apiKey);

    return client;
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
    if (!gemini) return null;

    const model = gemini.getGenerativeModel({
      model: options?.model || 'gemini-pro',
    });

    // Gemini는 대화 히스토리를 단일 프롬프트로 변환
    const prompt = messages
      .map((m) => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        return `${role}: ${m.content}`;
      })
      .join('\n\n') + '\n\nAssistant:';

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature || 0.7,
      },
    });

    const response = result.response;
    return response.text() || null;
  } catch (error) {
    logger.error('Gemini chat error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

