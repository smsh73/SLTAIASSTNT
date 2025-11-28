import nodemailer from 'nodemailer';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({
  screenName: 'Notifications',
  callerFunction: 'EmailService',
});

// 이메일 전송 설정
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpUser || !smtpPassword) {
    logger.warning('SMTP configuration not found, email notifications disabled', {
      logType: 'warning',
    });
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  return transporter;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const emailTransporter = getTransporter();
    if (!emailTransporter) {
      logger.warning('Email transporter not available', {
        logType: 'warning',
      });
      return false;
    }

    const mailOptions = {
      from: options.from || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    };

    const info = await emailTransporter.sendMail(mailOptions);

    logger.success('Email sent successfully', {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      logType: 'success',
    });

    return true;
  } catch (error) {
    logger.error('Failed to send email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject,
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
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  
  if (adminEmails.length === 0) {
    return false;
  }

  const subject = `[AI Assistant] 오류 발생: ${error.message}`;
  const html = `
    <h2>오류 발생 알림</h2>
    <p><strong>오류 메시지:</strong> ${error.message}</p>
    <p><strong>발생 시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
    ${context ? `<p><strong>컨텍스트:</strong><pre>${JSON.stringify(context, null, 2)}</pre></p>` : ''}
    <p><strong>스택 트레이스:</strong></p>
    <pre>${error.stack || 'N/A'}</pre>
  `;

  return await sendEmail({
    to: adminEmails,
    subject,
    html,
  });
}

export async function sendSystemAlert(
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info'
): Promise<boolean> {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  
  if (adminEmails.length === 0) {
    return false;
  }

  const subject = `[AI Assistant] ${severity.toUpperCase()}: ${title}`;
  const html = `
    <h2>${title}</h2>
    <p><strong>심각도:</strong> ${severity}</p>
    <p><strong>메시지:</strong> ${message}</p>
    <p><strong>발생 시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
  `;

  return await sendEmail({
    to: adminEmails,
    subject,
    html,
  });
}

