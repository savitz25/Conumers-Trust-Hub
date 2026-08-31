import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('mail operational logs exclude recipient and provider response content', () => {
  const source = readFileSync('lib/customer/mail.ts', 'utf8');
  assert.doesNotMatch(source, /customerLog\([^\n]+\bto\s*:/);
  assert.doesNotMatch(source, /customerLog\([^\n]+\bbody\s*:/);
  assert.match(source, /customerLog\('mail_failed', \{ status: res\.status \}/);
});
