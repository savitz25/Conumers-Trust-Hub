import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('mail operational logs exclude recipient and provider response content', () => {
  const source = readFileSync('lib/customer/mail.ts', 'utf8');
  assert.doesNotMatch(source, /customerLog\([^\n]+\bto\s*:/);
  assert.doesNotMatch(source, /customerLog\([^\n]+\bbody\s*:/);
  assert.match(source, /customerLog\('mail_failed', \{ status: res\.status \}/);
});

test('provider network failure is returned, not thrown into a customer transaction', async () => {
  const previousKey=process.env.RESEND_API_KEY,previousFetch=globalThis.fetch;
  process.env.RESEND_API_KEY='test-key';
  globalThis.fetch=async()=>{throw new Error('synthetic provider failure')};
  try {
    const {resendMailer}=await import('./mail.ts');
    assert.deepEqual(await resendMailer({to:'owner@example.test',subject:'Synthetic',html:'<p>x</p>',text:'x'}),{sent:false});
  } finally { globalThis.fetch=previousFetch; if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey; }
});
