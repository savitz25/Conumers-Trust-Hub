/** Public inbox shared with Contact and Corrections. Keep aligned with BRAND.email. */
export const RESEARCH_SERVICES_INQUIRY = {
  inbox: 'hello@asktrusthub.com',
  fallback: 'mailto',
  storage: 'ask_customer_postgres',
} as const;

/** Hidden field. Browsers should leave it blank. A value rejects the request before storage. */
export const RESEARCH_INQUIRY_HONEYPOT = 'company_website_leave_blank';

export const RESEARCH_INQUIRY_LIMITS = {
  attempt: { max: 10, windowMs: 10 * 60 * 1000 },
  ip: { max: 8, windowMs: 60 * 60 * 1000 },
  email: { max: 3, windowMs: 24 * 60 * 60 * 1000 },
  global: { max: 60, windowMs: 60 * 60 * 1000 },
  duplicateWindowMs: 15 * 60 * 1000,
} as const;

const BLOCKED_PAYLOAD_KEYS = ['vendors', 'vendorList', 'vendor_list', 'attachment', 'attachments', 'documents', 'files'] as const;

export function researchInquiryDevPreview(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'development' && env.VERCEL !== '1' && !env.VERCEL_ENV && env.RESEARCH_SERVICES_INQUIRY_UI === 'server';
}

export function researchInquiryReceiptCopy(receiptId: string): string {
  return `Your sample request is saved. Reference ${receiptId}. Ask Trust Hub will follow up at the work email you entered.`;
}

export function researchInquiryUnsavedCopy(): string {
  return 'This request was not saved. Your entries are still in the form. Email hello@asktrusthub.com to send it.';
}

export function researchInquiryRateLimitCopy(): string {
  return 'Too many requests were sent from this network. Your entries are still in the form. Wait and try again, or email hello@asktrusthub.com.';
}

export function researchInquiryPayloadBlocked(body: Record<string, unknown>): boolean {
  return BLOCKED_PAYLOAD_KEYS.some((key) => {
    const value = body[key];
    if (value == null || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

export const RESEARCH_SERVICE_ROLES = [
  'Property manager',
  'Association manager',
  'Board member',
  'Other',
] as const;

export const RESEARCH_SERVICE_VENDOR_COUNTS = [
  '1–10',
  '11–25',
  '26–50',
  '51–100',
  'More than 100',
] as const;

export type ResearchServiceRole = (typeof RESEARCH_SERVICE_ROLES)[number];
export type ResearchServiceVendorCount = (typeof RESEARCH_SERVICE_VENDOR_COUNTS)[number];

export type ResearchInquiryInput = {
  name: string;
  email: string;
  organization: string;
  role: string;
  vendorCount: string;
  message: string;
};

export type ResearchInquiryField = keyof ResearchInquiryInput;

export type ResearchInquiryErrors = Partial<Record<ResearchInquiryField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENSITIVE_NUMBER = /\b\d{3}-\d{2}-\d{4}\b|\b(?:\d[ -]?){13,16}\b/;

function clean(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function validateResearchInquiry(input: ResearchInquiryInput):
  | { ok: true; value: ResearchInquiryInput }
  | { ok: false; errors: ResearchInquiryErrors } {
  const value: ResearchInquiryInput = {
    name: clean(input.name || ''),
    email: clean(input.email || ''),
    organization: clean(input.organization || ''),
    role: clean(input.role || ''),
    vendorCount: clean(input.vendorCount || ''),
    message: (input.message || '').replace(/\r\n/g, '\n').trim(),
  };
  const errors: ResearchInquiryErrors = {};

  if (SENSITIVE_NUMBER.test(value.name)) {
    errors.name = 'Leave out Social Security numbers, card numbers, and other sensitive numbers.';
  } else if (value.name.length < 2 || value.name.length > 80) {
    errors.name = 'Enter your name, using 2 to 80 characters.';
  }
  if (!EMAIL_PATTERN.test(value.email) || value.email.length > 120) {
    errors.email = 'Enter a work email address.';
  } else if (SENSITIVE_NUMBER.test(value.email)) {
    errors.email = 'Leave out Social Security numbers, card numbers, and other sensitive numbers.';
  }
  if (SENSITIVE_NUMBER.test(value.organization)) {
    errors.organization = 'Leave out Social Security numbers, card numbers, and other sensitive numbers.';
  } else if (value.organization.length < 2 || value.organization.length > 120) {
    errors.organization = 'Enter your organization, using 2 to 120 characters.';
  }
  if (!RESEARCH_SERVICE_ROLES.includes(value.role as ResearchServiceRole)) {
    errors.role = 'Choose your role.';
  }
  if (!RESEARCH_SERVICE_VENDOR_COUNTS.includes(value.vendorCount as ResearchServiceVendorCount)) {
    errors.vendorCount = 'Choose an approximate vendor count.';
  }
  if (value.message.length > 1000) {
    errors.message = 'Keep the message to 1,000 characters.';
  } else if (SENSITIVE_NUMBER.test(value.message)) {
    errors.message = 'Leave out Social Security numbers, card numbers, and other sensitive numbers.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

export function researchServicesRequestDetails(value: ResearchInquiryInput): string {
  return [
    'To: hello@asktrusthub.com',
    'Subject: Trust Hub Research Services sample request',
    '',
    'Trust Hub Research Services',
    'Florida vendor-review sample request',
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
    'This first email does not include vendor documents.',
  ].join('\n');
}

export function researchServicesMailto(value: ResearchInquiryInput, inbox = RESEARCH_SERVICES_INQUIRY.inbox): string {
  const details = researchServicesRequestDetails(value);
  const [, subjectLine, , ...bodyLines] = details.split('\n');
  const subject = subjectLine.replace(/^Subject: /, '');
  const body = bodyLines.join('\n');
  return `mailto:${inbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
