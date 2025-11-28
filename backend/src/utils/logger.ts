import winston from 'winston';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

interface LogData {
  userId?: number;
  screenName?: string;
  screenUrl?: string;
  callerFunction?: string;
  buttonId?: string;
  calledApi?: string;
  backendApiUrl?: string;
  logType: 'info' | 'success' | 'error' | 'warning' | 'debug';
  message?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
  // 추가 필드들 (metadata에 저장)
  [key: string]: any;
}

export async function logToDatabase(data: LogData): Promise<void> {
  try {
    // 비동기로 로깅 (블로킹 방지)
    setImmediate(async () => {
      try {
        await prisma.log.create({
          data: {
            userId: data.userId,
            screenName: data.screenName,
            screenUrl: data.screenUrl,
            callerFunction: data.callerFunction,
            buttonId: data.buttonId,
            calledApi: data.calledApi,
            backendApiUrl: data.backendApiUrl,
            logType: data.logType,
            message: data.message?.substring(0, 5000), // 메시지 길이 제한
            errorCode: data.errorCode,
            metadata: data.metadata || {},
          },
        });
      } catch (dbError) {
        // 데이터베이스 로깅 실패는 콘솔에만 기록 (무한 루프 방지)
        console.error('Failed to log to database:', dbError);
      }
    });
  } catch (error) {
    // 로깅 실패는 무시 (시스템 안정성 우선)
    console.error('Failed to queue log:', error);
  }
}

export function createLogger(context: {
  screenName?: string;
  screenUrl?: string;
  callerFunction?: string;
}) {
  return {
    info: (message: string, data?: Partial<LogData>) => {
      const logData = {
        ...context,
        ...data,
        logType: 'info' as const,
        message,
      };
      logger.info(message, logData);
      logToDatabase(logData);
    },
    success: (message: string, data?: Partial<LogData>) => {
      const logData = {
        ...context,
        ...data,
        logType: 'success' as const,
        message,
      };
      logger.info(message, logData);
      logToDatabase(logData);
    },
    error: (message: string, data?: Partial<LogData>) => {
      const logData = {
        ...context,
        ...data,
        logType: 'error' as const,
        message,
      };
      logger.error(message, logData);
      logToDatabase(logData);
    },
    warning: (message: string, data?: Partial<LogData>) => {
      const logData = {
        ...context,
        ...data,
        logType: 'warning' as const,
        message,
      };
      logger.warn(message, logData);
      logToDatabase(logData);
    },
    debug: (message: string, data?: Partial<LogData>) => {
      const logData = {
        ...context,
        ...data,
        logType: 'debug' as const,
        message,
      };
      logger.debug(message, logData);
      logToDatabase(logData);
    },
  };
}

