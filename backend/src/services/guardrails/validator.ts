import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../utils/logger.js';

const prisma = new PrismaClient();
const logger = createLogger({
  screenName: 'Guardrails',
  callerFunction: 'GuardrailValidator',
});

export interface ValidationResult {
  isValid: boolean;
  action: 'block' | 'warn' | 'modify';
  message?: string;
  modifiedPrompt?: string;
}

export async function validatePrompt(prompt: string): Promise<ValidationResult> {
  try {
    const guardrails = await prisma.guardrail.findMany({
      where: { isActive: true },
    });

    for (const guardrail of guardrails) {
      const pattern = new RegExp(guardrail.pattern, 'i');
      if (pattern.test(prompt)) {
        logger.warning('Prompt validation failed', {
          guardrailId: guardrail.id,
          guardrailName: guardrail.name,
          action: guardrail.action,
          logType: 'warning',
        });

        switch (guardrail.action) {
          case 'block':
            return {
              isValid: false,
              action: 'block',
              message: `프롬프트가 차단되었습니다: ${guardrail.name}`,
            };

          case 'warn':
            return {
              isValid: true,
              action: 'warn',
              message: `경고: ${guardrail.name}`,
            };

          case 'modify':
            // 프롬프트 수정 (간단한 구현)
            const modifiedPrompt = prompt.replace(pattern, '');
            return {
              isValid: true,
              action: 'modify',
              message: `프롬프트가 수정되었습니다: ${guardrail.name}`,
              modifiedPrompt,
            };

          default:
            break;
        }
      }
    }

    return {
      isValid: true,
      action: 'block', // 기본값
    };
  } catch (error) {
    logger.error('Prompt validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    // 에러 발생 시 허용
    return {
      isValid: true,
      action: 'block',
    };
  }
}

