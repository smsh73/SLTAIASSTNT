import { CircuitBreaker, CircuitState, getCircuitBreaker } from '../../../services/ai/circuitBreaker';

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringPeriod: 1000,
    });
  });

  describe('Circuit Breaker States', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN after failure threshold', async () => {
      // 실패 임계값까지 실패 시도
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // 에러 무시
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // 먼저 OPEN 상태로 전환
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // 에러 무시
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // 리셋 타임아웃 대기
      await new Promise(resolve => setTimeout(resolve, 1100));

      // HALF_OPEN 상태로 전환되어야 함
      const state = circuitBreaker.getState();
      expect([CircuitState.HALF_OPEN, CircuitState.CLOSED]).toContain(state);
    });
  });

  describe('execute', () => {
    it('should execute function successfully in CLOSED state', async () => {
      const result = await circuitBreaker.execute(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should use fallback when circuit is OPEN', async () => {
      // OPEN 상태로 전환
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // 에러 무시
        }
      }

      const result = await circuitBreaker.execute(
        async () => {
          throw new Error('Should not execute');
        },
        async () => {
          return 'fallback';
        }
      );

      expect(result).toBe('fallback');
    });

    it('should recover to CLOSED after successful executions in HALF_OPEN', async () => {
      // OPEN 상태로 전환
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // 에러 무시
        }
      }

      // 리셋 타임아웃 대기
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 성공적인 실행
      await circuitBreaker.execute(async () => {
        return 'success';
      });

      await circuitBreaker.execute(async () => {
        return 'success';
      });

      // CLOSED 상태로 복구되어야 함
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should return same instance for same provider', () => {
      const breaker1 = getCircuitBreaker('test-provider');
      const breaker2 = getCircuitBreaker('test-provider');

      expect(breaker1).toBe(breaker2);
    });

    it('should return different instances for different providers', () => {
      const breaker1 = getCircuitBreaker('provider1');
      const breaker2 = getCircuitBreaker('provider2');

      expect(breaker1).not.toBe(breaker2);
    });
  });
});

