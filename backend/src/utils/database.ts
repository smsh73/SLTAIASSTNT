import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger.js';

const logger = createLogger({
  screenName: 'Database',
  callerFunction: 'DatabaseConnection',
});

// Prisma 클라이언트 싱글톤 인스턴스
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn']
        : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // 연결 풀 설정
    // Prisma는 내부적으로 연결 풀을 관리하지만, 환경 변수로 최적화 가능
    // DATABASE_URL에 ?connection_limit=10&pool_timeout=20 같은 파라미터 추가 가능

    logger.info('Prisma client initialized', {
      logType: 'info',
    });

    // 애플리케이션 종료 시 연결 정리
    process.on('beforeExit', async () => {
      await prismaInstance?.$disconnect();
      logger.info('Prisma client disconnected', {
        logType: 'info',
      });
    });
  }

  return prismaInstance;
}

// 연결 상태 확인
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database connection check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return false;
  }
}

// 연결 풀 통계 (Prisma는 직접 제공하지 않으므로 간단한 래퍼)
export async function getConnectionStats() {
  try {
    const prisma = getPrismaClient();
    // Prisma는 내부적으로 연결 풀을 관리하므로 직접 통계를 가져올 수 없음
    // 대신 간단한 쿼리로 연결 상태 확인
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const queryTime = Date.now() - startTime;

    return {
      connected: true,
      queryTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

