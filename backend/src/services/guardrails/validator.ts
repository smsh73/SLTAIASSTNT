import { createLogger } from '../../utils/logger.js';
import { getPrismaClient } from '../../utils/database.js';

const prisma = getPrismaClient();
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
            // 프롬프트 수정 (AI 기반 개선)
            try {
              const { orchestrateAI } = await import('../ai/orchestrator.js');
              const modificationPrompt = `다음 프롬프트에서 부적절한 내용을 제거하고 적절하게 수정해주세요:\n\n${prompt}\n\n원본 프롬프트의 의도는 유지하되, 부적절한 부분만 제거하거나 대체해주세요.`;
              
              const modified = await orchestrateAI(
                [
                  {
                    role: 'system',
                    content: '당신은 프롬프트 수정 전문가입니다. 부적절한 내용을 제거하고 적절하게 수정합니다.',
                  },
                  {
                    role: 'user',
                    content: modificationPrompt,
                  },
                ],
                modificationPrompt
              );

              const modifiedPrompt = modified || prompt.replace(pattern, '');
              
              return {
                isValid: true,
                action: 'modify',
                message: `프롬프트가 수정되었습니다: ${guardrail.name}`,
                modifiedPrompt,
              };
            } catch (error) {
              // AI 수정 실패 시 단순 패턴 제거
              const modifiedPrompt = prompt.replace(pattern, '');
              return {
                isValid: true,
                action: 'modify',
                message: `프롬프트가 수정되었습니다: ${guardrail.name}`,
                modifiedPrompt,
              };
            }

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

