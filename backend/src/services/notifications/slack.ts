import axios from 'axios';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Notifications',
  callerFunction: 'SlackService',
});

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export interface SlackMessage {
  text: string;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  attachments?: Array<{
    color?: string;
    title?: string;
    text?: string;
    fields?: Array<{
      title: string;
      value: string;
      short?: boolean;
    }>;
    footer?: string;
    ts?: number;
  }>;
}

export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  try {
    if (!SLACK_WEBHOOK_URL) {
      logger.warning('Slack webhook URL not configured', {
        logType: 'warning',
      });
      return false;
    }

    const payload = {
      text: message.text,
      channel: message.channel,
      username: message.username || 'AI Assistant Bot',
      icon_emoji: message.icon_emoji || ':robot_face:',
      attachments: message.attachments,
    };

    const response = await axios.post(SLACK_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      logger.success('Slack message sent successfully', {
        channel: message.channel,
        logType: 'success',
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to send Slack message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      logType: 'error',
    });
    return false;
  }
}

// 알림 템플릿
export async function sendErrorAlert(
  error: Error,
  context?: Record<string, any>
): Promise<boolean> {
  const message: SlackMessage = {
    text: '오류 발생 알림',
    icon_emoji: ':x:',
    attachments: [
      {
        color: 'danger',
        title: error.message,
        text: error.stack || '스택 트레이스 없음',
        fields: context
          ? Object.entries(context).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            }))
          : [],
        footer: 'AI Assistant System',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  return await sendSlackMessage(message);
}

export async function sendSystemAlert(
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info'
): Promise<boolean> {
  const colors = {
    info: 'good',
    warning: 'warning',
    error: 'danger',
  };

  const emojis = {
    info: ':information_source:',
    warning: ':warning:',
    error: ':x:',
  };

  const slackMessage: SlackMessage = {
    text: title,
    icon_emoji: emojis[severity],
    attachments: [
      {
        color: colors[severity],
        title,
        text: message,
        footer: 'AI Assistant System',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  return await sendSlackMessage(slackMessage);
}

export async function sendWorkflowNotification(
  workflowId: number,
  status: 'started' | 'completed' | 'failed',
  message?: string
): Promise<boolean> {
  const statusEmojis = {
    started: ':hourglass_flowing_sand:',
    completed: ':white_check_mark:',
    failed: ':x:',
  };

  const statusColors = {
    started: '#36a64f',
    completed: 'good',
    failed: 'danger',
  };

  const slackMessage: SlackMessage = {
    text: `워크플로우 ${status}`,
    icon_emoji: statusEmojis[status],
    attachments: [
      {
        color: statusColors[status],
        title: `워크플로우 #${workflowId}`,
        text: message || `상태: ${status}`,
        footer: 'AI Assistant System',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  return await sendSlackMessage(slackMessage);
}

