import { createLogger } from '../../utils/logger.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'WeightManager',
});

export interface ProviderWeight {
  provider: 'openai' | 'claude' | 'gemini' | 'perplexity' | 'luxia';
  weight: number;
  isActive: boolean;
}

export async function getProviderWeights(): Promise<ProviderWeight[]> {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        isActive: true,
      },
      select: {
        provider: true,
        weight: true,
        isActive: true,
      },
    });

    // 프로바이더별로 최고 가중치 선택
    const providerMap = new Map<string, ProviderWeight>();

    for (const key of apiKeys) {
      const provider = key.provider as ProviderWeight['provider'];
      const existing = providerMap.get(provider);
      const keyWeight = typeof key.weight === 'object' ? Number(key.weight) : Number(key.weight);

      if (!existing || keyWeight > existing.weight) {
        providerMap.set(provider, {
          provider,
          weight: keyWeight,
          isActive: key.isActive,
        });
      }
    }

    return Array.from(providerMap.values());
  } catch (error) {
    logger.error('Failed to get provider weights', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return [];
  }
}

export async function selectProvider(
  preferredProvider?: string
): Promise<'openai' | 'claude' | 'gemini' | 'perplexity' | 'luxia' | null> {
  try {
    const weights = await getProviderWeights();

    if (weights.length === 0) {
      logger.warning('No active providers available', {
        logType: 'warning',
      });
      return null;
    }

    // 선호 프로바이더가 있고 활성화되어 있으면 우선 선택
    if (preferredProvider) {
      const preferred = weights.find(
        (w) => w.provider === preferredProvider && w.isActive
      );
      if (preferred) {
        return preferred.provider;
      }
    }

    // 가중치 기반 랜덤 선택
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const weight of weights) {
      random -= weight.weight;
      if (random <= 0) {
        return weight.provider;
      }
    }

    // 폴백: 첫 번째 활성화된 프로바이더
    return weights[0]?.provider || null;
  } catch (error) {
    logger.error('Failed to select provider', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return null;
  }
}

