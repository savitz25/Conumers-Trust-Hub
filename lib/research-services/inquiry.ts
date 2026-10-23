/** Public inbox shared with Contact and Corrections. Keep aligned with BRAND.email. */
export const RESEARCH_SERVICES_INQUIRY = {
  delivery: 'mailto',
  endpoint: null,
  inbox: 'hello@asktrusthub.com',
  reason:
    'Ask Trust Hub has no inquiry submission endpoint. Contact and corrections are sent by email.',
} as const;

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

  if (value.name.length < 2 || value.name.length > 80) {
    errors.name = 'Enter your name, using 2 to 80 characters.';
  }
  if (!EMAIL_PATTERN.test(value.email) || value.email.length > 120) {
    errors.email = 'Enter a work email address.';
  }
  if (value.organization.length < 2 || value.organization.length > 120) {
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

export function researchServicesMailto(value: ResearchInquiryInput, inbox = RESEARCH_SERVICES_INQUIRY.inbox): string {
  const subject = 'Trust Hub Research Services sample request';
  const body = [
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
  return `mailto:${inbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
