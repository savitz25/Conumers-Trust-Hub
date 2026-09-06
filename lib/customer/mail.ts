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
  if (
    process.env.VERCEL_ENV === 'preview' &&
    process.env.ATH_FIXTURE_ENV === 'preview' &&
    process.env.ATH_ALLOW_SYNTHETIC_FIXTURE === '1'
  ) {
    customerLog('mail_preview_fixture_sink', { subject: message.subject });
    return { sent: false, preview: message.text };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    customerLog('mail_preview', { subject: message.subject });
    return { sent: false, preview: message.text };
  }
  let res:Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({from:askFromEmail(),to:[message.to],subject:message.subject,html:message.html,text:message.text}),
    });
  } catch {
    customerLog('mail_failed', { status: 'network_error' }, 'error');
    return { sent: false };
  }
  if (!res.ok) {
    await res.body?.cancel();
    customerLog('mail_failed', { status: res.status }, 'error');
    return { sent: false };
  }
  customerLog('mail_sent', { subject: message.subject });
  return { sent: true };
};
