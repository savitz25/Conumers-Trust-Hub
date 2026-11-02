import { askFromEmail } from '../customer/mail.ts';
import { RESEARCH_SERVICES_INQUIRY, type ResearchInquiryInput } from './inquiry.ts';

export type InquiryNotice = {
  to: string;
  subject: string;
  text: string;
};

export type InquiryMailResult = {
  delivered: boolean;
  providerRef?: string;
  errorCode?: 'unconfigured' | 'provider_rejected' | 'network';
};

export type InquiryMailer = (notice: InquiryNotice) => Promise<InquiryMailResult>;

const SUBJECT = 'Trust Hub Research Services sample request';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildResearchInquiryNotice(receiptId: string, value: ResearchInquiryInput): InquiryNotice {
  return {
    to: RESEARCH_SERVICES_INQUIRY.inbox,
    subject: SUBJECT,
    text: [
      'Trust Hub Research Services',
      'Florida vendor-review sample request',
      `Receipt: ${receiptId}`,
      '',
      `Name: ${value.name}`,
      `Work email: ${value.email}`,
      `Organization: ${value.organization}`,
      `Role: ${value.role}`,
      `Approximate vendor count: ${value.vendorCount}`,
      '',
      'Message:',
      value.message || '(none)',
      '',
      'This notice goes only to the Ask Trust Hub inbox. It is not sent to the visitor.',
      'The first request does not include vendor documents.',
    ].join('\n'),
  };
}

export function createInquiryMailer(
  env: { [key: string]: string | undefined },
  fetchImpl: typeof fetch = fetch,
): InquiryMailer {
  return async (notice) => {
    if (notice.to !== RESEARCH_SERVICES_INQUIRY.inbox) {
      return { delivered: false, errorCode: 'provider_rejected' };
    }
    const testTransport = env.RESEARCH_SERVICES_MAIL_TRANSPORT === 'test' && env.VERCEL_ENV !== 'production';
    if (testTransport) return { delivered: true, providerRef: 'test-transport' };
    const key = env.RESEND_API_KEY;
    if (!key) return { delivered: false, errorCode: 'unconfigured' };
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: askFromEmail(),
          to: [notice.to],
          subject: notice.subject,
          text: notice.text,
          html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(notice.text)}</div>`,
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return { delivered: false, errorCode: 'provider_rejected' };
      }
      const payload = await response.json().catch(() => ({})) as { id?: unknown };
      const providerRef = typeof payload.id === 'string' ? payload.id.slice(0, 120) : undefined;
      return { delivered: true, providerRef };
    } catch {
      return { delivered: false, errorCode: 'network' };
    }
  };
}
