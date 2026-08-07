/**
 * Ask Trust Hub transactional email design system.
 * Keep in sync with lib/design/ask-design-system.ts and BRAND_LOGO_VERSION.
 */

import { BRAND, BRAND_LOGO_VERSION } from '@/lib/brand';
import { ASK_BRAND, ASK_INDEPENDENCE_LINE, ASK_NETWORK_LINKS } from '@/lib/design/ask-design-system';

export const EMAIL_BRAND = {
  name: BRAND.name,
  siteUrl: BRAND.url,
  supportEmail: BRAND.email,
  logoUrl: `${BRAND.url}/brand/logo.png?v=${BRAND_LOGO_VERSION}`,
  indigo: ASK_BRAND.indigo,
  purple: ASK_BRAND.purple,
  navy: ASK_BRAND.navy,
  ink: ASK_BRAND.ink,
  inkMuted: '#334155',
  white: ASK_BRAND.white,
  bg: ASK_BRAND.canvas,
  border: ASK_BRAND.border,
  periwinkle: ASK_BRAND.periwinkle,
  footerMuted: ASK_BRAND.onNavyMuted,
  independenceUrl: `${BRAND.url}/promise`,
  contactUrl: `${BRAND.url}/contact`,
  privacyUrl: `${BRAND.url}/privacy`,
  network: ASK_NETWORK_LINKS,
  independenceLine: ASK_INDEPENDENCE_LINE,
} as const;

export function buildEmailHeader(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.white};border:1px solid ${EMAIL_BRAND.border};border-bottom:0;border-radius:12px 12px 0 0;">
      <tr>
        <td style="padding:24px 28px;text-align:center;">
          <a href="${EMAIL_BRAND.siteUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
            <img src="${EMAIL_BRAND.logoUrl}" alt="${EMAIL_BRAND.name}" width="200" style="display:inline-block;border:0;max-width:200px;height:auto;" />
          </a>
        </td>
      </tr>
    </table>`;
}

export function buildEmailFooter(opts?: { unsubscribeHtml?: string }): string {
  const unsub =
    opts?.unsubscribeHtml ??
    `You received this from ${EMAIL_BRAND.name}. <a href="${EMAIL_BRAND.contactUrl}" style="color:#A5B4FC;text-decoration:underline;">Contact us</a> to manage preferences.`;

  const hubLinks = EMAIL_BRAND.network
    .map(
      (h) =>
        `<a href="${h.href}" style="color:#A5B4FC;text-decoration:none;margin:0 6px;">${h.shortLabel}</a>`
    )
    .join(`<span style="color:#475569;">·</span>`);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.navy};border-radius:0 0 12px 12px;">
      <tr>
        <td style="padding:28px 24px;text-align:center;">
          <a href="${EMAIL_BRAND.siteUrl}" target="_blank" rel="noopener noreferrer">
            <img src="${EMAIL_BRAND.logoUrl}" alt="${EMAIL_BRAND.name}" width="160" style="display:inline-block;border:0;max-width:160px;height:auto;" />
          </a>
          <p style="margin:14px 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:#FFFFFF;">
            Part of the Ask Trust Hub network
          </p>
          <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${EMAIL_BRAND.footerMuted};">
            ${EMAIL_BRAND.independenceLine}
          </p>
          <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;">
            ${hubLinks}
          </p>
          <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;">
            <a href="${EMAIL_BRAND.siteUrl}" style="color:#A5B4FC;text-decoration:none;margin:0 6px;">Website</a>
            <span style="color:#475569;">·</span>
            <a href="${EMAIL_BRAND.independenceUrl}" style="color:#A5B4FC;text-decoration:none;margin:0 6px;">Independence Policy</a>
            <span style="color:#475569;">·</span>
            <a href="${EMAIL_BRAND.contactUrl}" style="color:#A5B4FC;text-decoration:none;margin:0 6px;">Contact</a>
          </p>
          <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.45;color:${EMAIL_BRAND.footerMuted};">
            ${unsub}
          </p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#64748B;">
            <a href="${EMAIL_BRAND.privacyUrl}" style="color:${EMAIL_BRAND.footerMuted};text-decoration:underline;">Privacy Policy</a>
          </p>
        </td>
      </tr>
    </table>`;
}

/** Full email shell — title, body HTML, optional CTA */
export function buildTransactionalEmail(options: {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
  unsubscribeHtml?: string;
}): string {
  const { title, bodyHtml, ctaLabel, ctaHref, footerNote, unsubscribeHtml } = options;

  const ctaBlock =
    ctaLabel && ctaHref
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
        <tr>
          <td style="border-radius:10px;background:${EMAIL_BRAND.indigo};">
            <a href="${ctaHref}" target="_blank" rel="noopener noreferrer"
              style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${EMAIL_BRAND.inkMuted};">
        If the button does not work, copy and paste this link:<br />
        <a href="${ctaHref}" style="color:${EMAIL_BRAND.indigo};word-break:break-all;">${ctaHref}</a>
      </p>`
      : '';

  const note = footerNote
    ? `<p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:${EMAIL_BRAND.inkMuted};">${footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — ${EMAIL_BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr><td>${buildEmailHeader()}</td></tr>
          <tr>
            <td style="background:${EMAIL_BRAND.white};border:1px solid ${EMAIL_BRAND.border};border-top:0;padding:28px 28px 32px;">
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_BRAND.indigo};">
                ${EMAIL_BRAND.name}
              </p>
              <h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:600;color:${EMAIL_BRAND.navy};">
                ${title}
              </h1>
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${EMAIL_BRAND.ink};">
                ${bodyHtml}
              </div>
              ${ctaBlock}
              ${note}
            </td>
          </tr>
          <tr><td>${buildEmailFooter({ unsubscribeHtml })}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Contact form acknowledgement (consumer-facing) */
export function buildContactAckEmail(name: string, subjectLabel: string): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = name.trim() || 'there';
  const html = buildTransactionalEmail({
    title: 'We received your message',
    bodyHtml: `
      <p style="margin:0 0 14px;">Hi ${escapeHtml(safeName)},</p>
      <p style="margin:0 0 14px;">
        Thank you for contacting Ask Trust Hub about <strong>${escapeHtml(subjectLabel)}</strong>.
        We typically respond within 2–5 business days.
      </p>
      <p style="margin:0 0 14px;">
        Independent research only — we do not sell placements or broker leads. Specialist directories
        live on Move, Lender, and Insurance Trust Hub.
      </p>
      <p style="margin:0;">We cite. You decide.</p>
    `,
    ctaLabel: 'Visit Ask Trust Hub',
    ctaHref: EMAIL_BRAND.siteUrl,
    unsubscribeHtml: 'You received this because you contacted Ask Trust Hub.',
  });

  const text = [
    `Hi ${safeName},`,
    '',
    `We received your message about ${subjectLabel}.`,
    'We typically respond within 2–5 business days.',
    '',
    EMAIL_BRAND.independenceLine,
    'We cite. You decide.',
    '',
    EMAIL_BRAND.siteUrl,
  ].join('\n');

  return {
    subject: 'We received your message — Ask Trust Hub',
    html,
    text,
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
