import { CLAIM_STATUS_COPY, RELATIONSHIP_LABELS, type ClaimStatus, type RelationshipType } from './types.ts';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const PUBLIC_LANGUAGE = {
  managedProfile: 'Managed profile',
  managedByRep: 'Profile managed by an authorized representative',
  authorizedToManage: 'Authorized to manage business-supplied information',
} as const;

export const FORBIDDEN_PUBLIC_PHRASES = [
  'TrustHub Verified Business',
  'Trusted contractor',
  'TrustHub approved',
  'TrustHub recommended',
  'Certified by TrustHub',
  'Premium profile',
  'Featured',
  'Sponsored ranking',
] as const;

export const DOCUMENT_UPLOAD_DECISION =
  'needs_info without uploads — document vault deferred to a later verification-hardening task';

export const LOGIN_EMAIL_CAVEAT =
  'Confirming your email does not verify that you own or manage a business.';

export const APPROVED_EMAIL_GRANT =
  'You are now authorized to manage business-supplied information';

export function containsForbiddenPublicLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PUBLIC_PHRASES.some((p) => lower.includes(p.toLowerCase()));
}

function wrapEmail(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<p><a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a></p>
       <p style="font-size:12px;color:#334155;">If the button does not work: ${escapeHtml(cta.href)}</p>`
    : '';
  return `<!DOCTYPE html><html lang="en"><body style="font-family:system-ui,sans-serif;color:#1e293b;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;">Ask Trust Hub</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    ${button}
    <p style="margin:24px 0 0;font-size:12px;color:#64748b;">AskTrustHub business account · not a ContractorTrustHub Home Passport · not an endorsement.</p>
  </div></body></html>`;
}

export function loginEmail(magicUrl: string): { subject: string; html: string; text: string } {
  const html = wrapEmail(
    'Confirm your AskTrustHub business account',
    `<p>Use this one-time link to confirm your AskTrustHub business account. It expires in about 30 minutes.</p>
     <p><strong>${LOGIN_EMAIL_CAVEAT}</strong> Management authorization is a separate review.</p>`,
    { label: 'Confirm email', href: magicUrl }
  );
  const text = [
    'Confirm your AskTrustHub business account.',
    '',
    LOGIN_EMAIL_CAVEAT,
    '',
    magicUrl,
    '',
    'This link expires in about 30 minutes.',
  ].join('\n');
  return { subject: 'Confirm your AskTrustHub business account', html, text };
}

export function claimReceivedEmail(opts: {
  displayName: string;
  credentialKey: string;
  status: ClaimStatus;
}): { subject: string; html: string; text: string } {
  const status = CLAIM_STATUS_COPY[opts.status];
  const html = wrapEmail(
    'We received your profile-management request',
    `<p>You asked to manage business-supplied information for <strong>${escapeHtml(opts.displayName)}</strong> (Florida DBPR credential ${escapeHtml(opts.credentialKey)}).</p>
     <p>Current state: <strong>${escapeHtml(status.title)}</strong>. ${escapeHtml(status.body)}</p>
     <p>This is not an endorsement, ranking, or “verified business” badge. Public research on ContractorTrustHub is unchanged.</p>`
  );
  const text = [
    `You asked to manage business-supplied information for ${opts.displayName} (${opts.credentialKey}).`,
    `${status.title}. ${status.body}`,
    'This is not an endorsement.',
  ].join('\n');
  return { subject: 'We received your AskTrustHub management request', html, text };
}

export function needsInfoEmail(opts: {
  displayName: string;
  nextAction: string;
}): { subject: string; html: string; text: string } {
  const html = wrapEmail(
    'More information is needed',
    `<p>We could not yet confirm your authority to manage the profile for <strong>${escapeHtml(opts.displayName)}</strong>.</p>
     <p>What to do next: ${escapeHtml(opts.nextAction)}</p>`
  );
  const text = [
    `We could not yet confirm your authority to manage the profile for ${opts.displayName}.`,
    `What to do next: ${opts.nextAction}`,
  ].join('\n');
  return { subject: 'More information is needed — AskTrustHub', html, text };
}

export function approvedEmail(opts: { displayName: string; manageUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const html = wrapEmail(
    'You can manage this profile',
    `<p>${APPROVED_EMAIL_GRANT} for <strong>${escapeHtml(opts.displayName)}</strong>.</p>
     <p>This is not a TrustHub endorsement and does not change official licensing or regulatory records.</p>`,
    { label: 'Open managed profile', href: opts.manageUrl }
  );
  const text = [
    `${APPROVED_EMAIL_GRANT} for ${opts.displayName}.`,
    'This is not a TrustHub endorsement.',
    opts.manageUrl,
  ].join('\n');
  return { subject: 'You can manage this AskTrustHub profile', html, text };
}

export function rejectedEmail(opts: { displayName: string; reason: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const html = wrapEmail(
    'We could not confirm authority',
    `<p>We could not confirm authority to manage the profile for <strong>${escapeHtml(opts.displayName)}</strong>.</p>
     <p>${escapeHtml(opts.reason)}</p>`
  );
  const text = [
    `We could not confirm authority to manage the profile for ${opts.displayName}.`,
    opts.reason,
  ].join('\n');
  return { subject: 'AskTrustHub could not confirm authority', html, text };
}

export function relationshipLabel(type: RelationshipType): string {
  return RELATIONSHIP_LABELS[type];
}
