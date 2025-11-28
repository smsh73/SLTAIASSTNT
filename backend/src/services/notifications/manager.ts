import { createLogger } from '../../utils/logger.js';
import { sendEmail, sendErrorAlert as sendEmailError, sendSystemAlert as sendEmailSystem } from './email.js';
import { sendSlackMessage, sendErrorAlert as sendSlackError, sendSystemAlert as sendSlackSystem, sendWorkflowNotification as sendSlackWorkflow } from './slack.js';

const logger = createLogger({
  screenName: 'Notifications',
  callerFunction: 'NotificationManager',
});

export interface NotificationOptions {
  email?: boolean;
  slack?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export class NotificationManager {
  private static instance: NotificationManager;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async sendError(
    error: Error,
    context?: Record<string, any>,
    options: NotificationOptions = {}
  ): Promise<void> {
    const { email = true, slack = true, priority = 'high' } = options;

    const promises: Promise<boolean>[] = [];

    if (email) {
      promises.push(sendEmailError(error, context));
    }

    if (slack) {
      promises.push(sendSlackError(error, context));
    }

    try {
      await Promise.allSettled(promises);
      logger.info('Error notifications sent', {
        error: error.message,
        priority,
        logType: 'info',
      });
    } catch (err) {
      logger.error('Failed to send error notifications', {
        error: err instanceof Error ? err.message : 'Unknown error',
        logType: 'error',
      });
    }
  }

  async sendSystemAlert(
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'error' = 'info',
    options: NotificationOptions = {}
  ): Promise<void> {
    const { email = true, slack = true } = options;

    const promises: Promise<boolean>[] = [];

    if (email) {
      promises.push(sendEmailSystem(title, message, severity));
    }

    if (slack) {
      promises.push(sendSlackSystem(title, message, severity));
    }

    try {
      await Promise.allSettled(promises);
      logger.info('System alert sent', {
        title,
        severity,
        logType: 'info',
      });
    } catch (err) {
      logger.error('Failed to send system alert', {
        error: err instanceof Error ? err.message : 'Unknown error',
        logType: 'error',
      });
    }
  }

  async sendWorkflowNotification(
    workflowId: number,
    status: 'started' | 'completed' | 'failed',
    message?: string,
    options: NotificationOptions = {}
  ): Promise<void> {
    const { slack = true } = options;

    if (slack) {
      try {
        await sendSlackWorkflow(workflowId, status, message);
        logger.info('Workflow notification sent', {
          workflowId,
          status,
          logType: 'info',
        });
      } catch (err) {
        logger.error('Failed to send workflow notification', {
          error: err instanceof Error ? err.message : 'Unknown error',
          logType: 'error',
        });
      }
    }
  }

  async sendCustomNotification(
    channels: Array<'email' | 'slack'>,
    content: {
      email?: { to: string | string[]; subject: string; text?: string; html?: string };
      slack?: { text: string; channel?: string };
    }
  ): Promise<void> {
    const promises: Promise<boolean>[] = [];

    if (channels.includes('email') && content.email) {
      const { sendEmail } = await import('./email.js');
      promises.push(sendEmail(content.email));
    }

    if (channels.includes('slack') && content.slack) {
      const { sendSlackMessage } = await import('./slack.js');
      promises.push(sendSlackMessage(content.slack));
    }

    try {
      await Promise.allSettled(promises);
      logger.info('Custom notifications sent', {
        channels,
        logType: 'info',
      });
    } catch (err) {
      logger.error('Failed to send custom notifications', {
        error: err instanceof Error ? err.message : 'Unknown error',
        logType: 'error',
      });
    }
  }
}

export const notificationManager = NotificationManager.getInstance();

