import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const store=readFileSync('lib/customer/store.ts','utf8');
const mail=readFileSync('lib/customer/mail.ts','utf8');

test('state-transition mail reuses the durable notification delivery ledger',()=>{assert.match(store,/ath-customer-email-v1/);assert.match(store,/ON CONFLICT\(notification_id,channel\) DO NOTHING/);assert.match(store,/ath_notification_deliveries/);});
test('provider throws are contained after customer state transitions',()=>{assert.match(store,/try\{sent=\(await this\.deps\.mailer/);assert.match(store,/catch\{sent=false\}/);assert.match(store,/customer_email_failed/);});
test('first approved profile onboarding is separately one-time keyed',()=>{assert.match(store,/FIRST_CLAIM_ONBOARDING/);assert.match(store,/stateVersion:'first-managed-profile'/);assert.match(store,/g\.id<>\$2/);});
test('ordinary analytics/log dimensions exclude customer identifiers and addresses',()=>{const helper=store.slice(store.indexOf('private async sendLifecycle'),store.indexOf('async hitRateLimit'));const logCalls=helper.match(/customerLog\([^\n]+/g)?.join('\n')||'';assert.doesNotMatch(logCalls,/claimId|profileId|organizationId|recipient|email:/);assert.match(logCalls,/emailType/);});
test('R2 fixture sink remains non-sending and production Resend remains configured',()=>{assert.match(mail,/mail_preview_fixture_sink/);assert.match(mail,/VERCEL_ENV === 'preview'/);assert.match(mail,/https:\/\/api\.resend\.com\/emails/);assert.match(mail,/Ask Trust Hub <hello@asktrusthub\.com>/);});
test('preview gallery is noindex and impossible to render in production',()=>{const page=readFileSync('app/internal/customer-email-previews/page.tsx','utf8');assert.match(page,/robots:\{index:false,follow:false\}/);assert.match(page,/VERCEL_ENV==='production'\)notFound/);});
test('delivery metadata stores no address, rendered body, subject, token, or credential',()=>{const helper=store.slice(store.indexOf('private async sendLifecycle'),store.indexOf('async hitRateLimit'));const payload=helper.match(/JSON\.stringify\(\{[^}]+\}\)/)?.[0]||'';assert.doesNotMatch(payload,/recipient|address|body|subject|token|credential/i);assert.match(payload,/email_type/);assert.match(payload,/object_type/);});
