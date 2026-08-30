import { customerLog } from './log.ts';

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type Mailer = (message: MailMessage) => Promise<{ sent: boolean; preview?: string }>;

export const ASK_FROM_EMAIL_DEFAULT = 'Ask Trust Hub <hello@asktrusthub.com>';

export function askFromEmail(): string {
  return process.env.ASK_AUTH_FROM_EMAIL || process.env.AUTH_FROM_EMAIL || ASK_FROM_EMAIL_DEFAULT;
}

export const resendMailer: Mailer = async (message) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    customerLog('mail_preview', { to: message.to, subject: message.subject });
    return { sent: false, preview: message.text };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: askFromEmail(),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    customerLog('mail_failed', { status: res.status, body: body.slice(0, 200) }, 'error');
    return { sent: false };
  }
  customerLog('mail_sent', { to: message.to, subject: message.subject });
  return { sent: true };
};
