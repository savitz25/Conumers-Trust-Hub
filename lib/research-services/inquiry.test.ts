import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  RESEARCH_INQUIRY_LIMITS,
  RESEARCH_SERVICES_INQUIRY,
  researchInquiryDevPreview,
  researchInquiryReceiptCopy,
  researchInquiryUnsavedCopy,
  researchServicesMailto,
  researchServicesRequestDetails,
  validateResearchInquiry,
} from './inquiry.ts';

const valid = {
  name: 'Avery Cole',
  email: 'avery@palmshore.example',
  organization: 'Palm Shore Management',
  role: 'Property manager',
  vendorCount: '11–25',
  message: 'We review roofing vendors for two associations.',
};

test('a complete sample request is valid and uses the public email inbox', () => {
  const brand = readFileSync('lib/brand.ts', 'utf8');
  assert.match(brand, /email: 'hello@asktrusthub.com'/);
  const result = validateResearchInquiry(valid);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const href = researchServicesMailto(result.value);
  assert.equal(RESEARCH_SERVICES_INQUIRY.fallback, 'mailto');
  assert.equal(RESEARCH_SERVICES_INQUIRY.storage, 'ask_customer_postgres');
  assert.equal(RESEARCH_SERVICES_INQUIRY.inbox, 'hello@asktrusthub.com');
  assert.equal(RESEARCH_INQUIRY_LIMITS.attempt.max, 10);
  assert.equal(RESEARCH_INQUIRY_LIMITS.email.max, 3);
  assert.equal(researchInquiryDevPreview({ NODE_ENV: 'production', RESEARCH_SERVICES_INQUIRY_UI: 'server' }), false);
  assert.equal(researchInquiryDevPreview({ NODE_ENV: 'development', VERCEL_ENV: 'preview', RESEARCH_SERVICES_INQUIRY_UI: 'server' }), false);
  assert.doesNotMatch(researchInquiryReceiptCopy('11111111-1111-4111-8111-111111111111'), /email was sent|successfully submitted|request received/i);
  assert.match(researchInquiryUnsavedCopy(), /not saved/);
  assert.match(href, /^mailto:hello@asktrusthub\.com\?/);
  assert.match(href, /Florida%20vendor-review%20sample%20request/);
  assert.doesNotMatch(href, /received|submitted/i);
  const details = researchServicesRequestDetails(result.value);
  assert.match(details, /To: hello@asktrusthub\.com/);
  assert.match(details, /Name: Avery Cole/);
});

test('missing and unsafe answers fail closed', () => {
  const missing = validateResearchInquiry({ ...valid, name: ' ', email: 'not-an-email', role: 'Owner', vendorCount: '2' });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.ok(missing.errors.name);
  assert.ok(missing.errors.email);
  assert.ok(missing.errors.role);
  assert.ok(missing.errors.vendorCount);

  const sensitive = validateResearchInquiry({ ...valid, message: 'SSN 123-45-6789' });
  assert.equal(sensitive.ok, false);
  if (sensitive.ok) return;
  assert.match(sensitive.errors.message || '', /sensitive numbers/);
});

test('the page uses precise finding definitions and protects against partial identity attribution', () => {
  const page = readFileSync('app/research-services/page.tsx', 'utf8');
  const form = readFileSync('components/research-services/sample-request-form.tsx', 'utf8');
  assert.match(page, /Know more about the contractors working on your properties/);
  assert.match(page, /Verified findings/);
  assert.match(page, /Items needing review/);
  assert.match(page, /Unverified information/);
  assert.match(page, /Paid research services do not influence Trust Hub’s public rankings or independent findings/);
  assert.match(page, /Facts tied to a confirmed vendor identity and cited evidence/);
  assert.match(page, /Confirmed vendor records or documented gaps requiring follow-up/);
  assert.match(page, /Unresolved identities or information supported by insufficient evidence/);
  assert.match(page, /never associated with a vendor based on a partial identity match/);
  assert.doesNotMatch(page, /inquiry submission endpoint/i);
  assert.doesNotMatch(page, /formal registered entity name.*published.*finalized/i);
  assert.doesNotMatch(page, /\$\d|testimonial|turnaround|monitoring|certified compliant|guaranteed/i);
  assert.match(form, /This form prepares an email to/);
  assert.match(form, /Save this request/);
  assert.match(form, /Email \{BRAND\.email\}/);
  assert.match(form, /researchInquiryReceiptCopy\(receiptId\)/);
  assert.match(form, /Copy request details/);
  assert.match(form, /role="status" aria-live="polite"/);
  assert.match(form, /Could not copy request details/);
  assert.match(form, /View request details to copy manually/);
  assert.doesNotMatch(form, /request received|successfully submitted|email was sent/i);
  assert.doesNotMatch(form, /trackEvent|posthog|data-analytics/i);
});
