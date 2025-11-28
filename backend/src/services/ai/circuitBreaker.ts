import { createLogger } from '../../utils/logger.js';
import { updateCircuitBreakerState } from '../../utils/metrics.js';

const logger = createLogger({
  screenName: 'AI',
  callerFunction: 'CircuitBreaker',
});

export interface CircuitBreakerOptions {
  failureThreshold: number; // 실패 임계값
  resetTimeout: number; // 리셋 타임아웃 (ms)
  monitoringPeriod: number; // 모니터링 기간 (ms)
}

export enum CircuitState {
  CLOSED = 'closed', // 정상 상태
  OPEN = 'open', // 차단 상태
  HALF_OPEN = 'half-open', // 테스트 상태
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1분
      monitoringPeriod: options.monitoringPeriod || 60000, // 1분
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      // 차단 상태에서 리셋 타임아웃 확인
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        updateCircuitBreakerState('unknown', 'half-open');
        logger.info('Circuit breaker entering half-open state', {
          logType: 'info',
        });
      } else {
        // 여전히 차단 상태
        logger.warning('Circuit breaker is open, using fallback', {
          logType: 'warning',
        });
        if (fallback) {
          return await fallback();
        }
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      // 성공 처리
      this.onSuccess();
      return result;
    } catch (error) {
      // 실패 처리
      this.onFailure();
      
      if (fallback) {
        logger.warning('Execution failed, using fallback', {
          error: error instanceof Error ? error.message : 'Unknown error',
          logType: 'warning',
        });
        return await fallback();
      }
      
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // 반열림 상태에서 성공이 연속으로 발생하면 닫힘 상태로 전환
      if (this.successCount >= 2) {
        this.state = CircuitState.CLOSED;
        updateCircuitBreakerState('unknown', 'closed');
        logger.info('Circuit breaker closed after successful recovery', {
          logType: 'success',
        });
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // 반열림 상태에서 실패하면 다시 열림 상태로
      this.state = CircuitState.OPEN;
      updateCircuitBreakerState('unknown', 'open');
      logger.warning('Circuit breaker reopened after failure in half-open state', {
        logType: 'warning',
      });
    } else if (this.failureCount >= this.options.failureThreshold) {
      // 실패 임계값 초과 시 열림 상태로
      this.state = CircuitState.OPEN;
      updateCircuitBreakerState('unknown', 'open');
      logger.error('Circuit breaker opened due to failure threshold', {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
        logType: 'error',
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.info('Circuit breaker manually reset', {
      logType: 'info',
    });
  }
}

// 프로바이더별 Circuit Breaker 인스턴스
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(provider: string): CircuitBreaker {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(
      provider,
      new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 1분
        monitoringPeriod: 60000,
      })
    );
  }
  return circuitBreakers.get(provider)!;
}

