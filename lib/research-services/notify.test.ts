import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESEARCH_SERVICES_INQUIRY } from './inquiry.ts';
import { buildResearchInquiryNotice, createInquiryMailer } from './notify.ts';

const value = {
  name: 'Avery Cole',
  email: 'avery@palmshore.example',
  organization: 'Palm Shore Management',
  role: 'Property manager',
  vendorCount: '11–25',
  message: 'Two associations.',
};

test('the inquiry notice goes to the Ask inbox and not the visitor', () => {
  const notice = buildResearchInquiryNotice('11111111-1111-4111-8111-111111111111', value);
  assert.equal(notice.to, RESEARCH_SERVICES_INQUIRY.inbox);
  assert.notEqual(notice.to, value.email);
  assert.match(notice.text, /Avery Cole/);
  assert.match(notice.text, /not sent to the visitor/);
});

test('mail transport stays on the test double unless production Resend is configured', async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ id: 'email_test_123' }), { status: 200 });
  };
  const preview = await createInquiryMailer(
    { RESEARCH_SERVICES_MAIL_TRANSPORT: 'test', VERCEL_ENV: 'preview', RESEND_API_KEY: 'not-used' },
    fetchImpl
  )(buildResearchInquiryNotice('11111111-1111-4111-8111-111111111111', value));
  assert.equal(preview.delivered, true);
  assert.equal(preview.providerRef, 'test-transport');
  assert.deepEqual(calls, []);

  const missing = await createInquiryMailer({ VERCEL_ENV: 'production' }, fetchImpl)(
    buildResearchInquiryNotice('11111111-1111-4111-8111-111111111111', value)
  );
  assert.deepEqual(missing, { delivered: false, errorCode: 'unconfigured' });
  assert.deepEqual(calls, []);

  const refused = await createInquiryMailer({ RESEND_API_KEY: 'test-key', VERCEL_ENV: 'production' }, fetchImpl)({
    to: value.email,
    subject: 'nope',
    text: 'nope',
  });
  assert.equal(refused.delivered, false);
  assert.deepEqual(calls, []);

  const sent = await createInquiryMailer(
    { RESEND_API_KEY: 'test-key', VERCEL_ENV: 'production', RESEARCH_SERVICES_MAIL_TRANSPORT: 'test' },
    fetchImpl
  )(buildResearchInquiryNotice('11111111-1111-4111-8111-111111111111', value));
  assert.equal(sent.delivered, true);
  assert.equal(sent.providerRef, 'email_test_123');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api\.resend\.com/);

  const failed = await createInquiryMailer({ RESEND_API_KEY: 'test-key', VERCEL_ENV: 'production' }, async () => {
    throw new Error('socket down avery@palmshore.example');
  })(buildResearchInquiryNotice('11111111-1111-4111-8111-111111111111', value));
  assert.deepEqual(failed, { delivered: false, errorCode: 'network' });
  assert.doesNotMatch(JSON.stringify(failed), /palmshore/);
});
