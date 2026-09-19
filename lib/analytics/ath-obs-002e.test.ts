/**
 * ATH-OBS-002E: `/claim/continue?auth_error=` must never carry a raw exception, email, token,
 * or arbitrary free text into any PostHog-captured URL, and the central sanitizer must strip it
 * defensively even if the application ever regresses.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeAnalyticsUrl, sanitizeCaptureResult, sanitizePageviewProperties, redactSensitiveParamsInText } from './privacy.ts';
import { claimAcceptErrorCode, claimSignInErrorMessage, readClaimAuthErrorParam, signInLinkErrorCode, CLAIM_AUTH_ERROR_CODES } from '../customer/auth-error-code.ts';

// ---------------------------------------------------------------- Layer 1: application never emits free text
test('claimAcceptErrorCode maps internal handoff/claim codes to the public recovery enum', () => {
  assert.equal(claimAcceptErrorCode('expired'), 'HANDOFF_EXPIRED');
  assert.equal(claimAcceptErrorCode('credential_mismatch'), 'PROFILE_IDENTITY_MISMATCH');
  assert.equal(claimAcceptErrorCode('unsupported_hub'), 'UNSUPPORTED_CUSTOMER_HUB');
});

test('claimAcceptErrorCode collapses an unmapped internal code or exception text to HANDOFF_INVALID', () => {
  assert.equal(claimAcceptErrorCode('some_future_driver_error_code'), 'HANDOFF_INVALID');
  assert.equal(claimAcceptErrorCode('unclassified_error'), 'HANDOFF_INVALID');
  assert.equal(claimAcceptErrorCode('TypeError: Cannot read properties of undefined (reading \'foo\') at /app/lib/x.ts:42'), 'HANDOFF_INVALID');
  assert.equal(claimAcceptErrorCode('user@example.com'), 'HANDOFF_INVALID');
  assert.equal(claimAcceptErrorCode(undefined), 'HANDOFF_INVALID');
  assert.equal(claimAcceptErrorCode(null), 'HANDOFF_INVALID');
  assert.equal(claimAcceptErrorCode(12345), 'HANDOFF_INVALID');
});

test('signInLinkErrorCode only ever returns one of the bounded sign-in enum values', () => {
  assert.equal(signInLinkErrorCode('expired_link'), 'expired_link');
  assert.equal(signInLinkErrorCode('consumed_link'), 'consumed_link');
  assert.equal(signInLinkErrorCode('some raw AuthError.code the driver invented'), 'auth_failed');
  assert.equal(signInLinkErrorCode(undefined), 'auth_failed');
});

// ---------------------------------------------------------------- Layer 1: the page re-validates its OWN inbound query
test('readClaimAuthErrorParam rejects an attacker-controlled query value that is not a known code', () => {
  const hostile = [
    'user@example.com',
    'a'.repeat(4000),
    '<script>alert(1)</script>',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    'Access Denied for user@example.com',
    '../../etc/passwd',
  ];
  for (const value of hostile) assert.equal(readClaimAuthErrorParam(value), 'HANDOFF_INVALID', value);
});

test('readClaimAuthErrorParam accepts only codes in the closed enum, and null/absent stays null', () => {
  for (const code of CLAIM_AUTH_ERROR_CODES) assert.equal(readClaimAuthErrorParam(code), code);
  assert.equal(readClaimAuthErrorParam(undefined), null);
  assert.equal(readClaimAuthErrorParam(''), null);
});

test('claimSignInErrorMessage renders safe UX copy for a sign-in failure and nothing for a claim-recovery code', () => {
  assert.match(claimSignInErrorMessage('expired_link') ?? '', /expired/i);
  assert.equal(claimSignInErrorMessage('HANDOFF_EXPIRED'), null, 'claim-recovery codes get their copy from ClaimRecoveryCard, not here');
  assert.equal(claimSignInErrorMessage(null), null);
});

// ---------------------------------------------------------------- Layer 2: central sanitizer, defense in depth
test('sanitizeAnalyticsUrl strips auth_error from $current_url even if it holds free text, an email, or a token', () => {
  const hostile = [
    'user@example.com',
    'A'.repeat(500) + ' provider stack trace with secret=abc123',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    'Access%20Denied%20for%20user@example.com',
  ];
  for (const value of hostile) {
    const url = sanitizeAnalyticsUrl(`https://www.asktrusthub.com/claim/continue?auth_error=${encodeURIComponent(value)}&handoff=abc123`);
    assert.ok(url);
    assert.doesNotMatch(url, /auth_error/i, value);
    assert.doesNotMatch(url, /example\.com/, value);
    assert.doesNotMatch(url, /secret/i, value);
    assert.doesNotMatch(url, /handoff=/i, value);
  }
});

test('the sanitizer covers name variants of the same carrier (authError, AUTH_ERROR, x_auth_error_msg)', () => {
  for (const key of ['authError', 'AUTH_ERROR', 'auth_error_message', 'x_auth_error']) {
    const url = sanitizeAnalyticsUrl(`https://www.asktrusthub.com/claim/continue?${key}=user@example.com`);
    assert.doesNotMatch(url ?? '', /example\.com/, key);
  }
});

test('$current_url, $session_entry_url, $initial_current_url and $entry_current_url are all sanitized', () => {
  const props = sanitizePageviewProperties({
    $current_url: 'https://www.asktrusthub.com/claim/continue?auth_error=HANDOFF_EXPIRED',
    $session_entry_url: 'https://www.asktrusthub.com/claim/continue?auth_error=user@example.com',
    $initial_current_url: 'https://www.asktrusthub.com/claim/continue?auth_error=abc.def.ghi-token',
    $entry_current_url: 'https://www.asktrusthub.com/claim/continue?auth_error=Access%20Denied',
  });
  for (const key of ['$current_url', '$session_entry_url', '$initial_current_url', '$entry_current_url']) {
    assert.doesNotMatch(String(props[key]), /auth_error/i, key);
  }
});

test('pageview URL through the full before_send path is safe, and safe UNRELATED params survive', () => {
  const event = sanitizeCaptureResult({
    event: '$pageview',
    properties: {
      token: 'phc_test_token',
      $current_url: 'https://www.asktrusthub.com/claim/continue?auth_error=expired_link&handoff=xyz&utm_source=newsletter&ref=email',
      $pathname: '/claim/continue',
    },
  });
  const url = String(event?.properties?.$current_url);
  assert.doesNotMatch(url, /auth_error/i);
  assert.doesNotMatch(url, /handoff=/i);
  assert.match(url, /utm_source=newsletter/);
  assert.match(url, /ref=email/);
  assert.equal(event?.properties?.token, 'phc_test_token', 'PostHog reserved keys still survive before_send');
});

test('a session_recording start_url (network-request-shaped sanitizer) strips auth_error the same way', () => {
  const request = { name: 'https://www.asktrusthub.com/claim/continue?auth_error=user@example.com&handoff=xyz' };
  const cleaned = { name: sanitizeAnalyticsUrl(request.name) } as { name: string };
  assert.doesNotMatch(cleaned.name, /auth_error/i);
  assert.doesNotMatch(cleaned.name, /example\.com/);
  assert.doesNotMatch(cleaned.name, /handoff=/i);
});

test('replay snapshot hrefs nested in $snapshot_data are sanitized (rrweb Meta href)', () => {
  const props = sanitizePageviewProperties({
    $pathname: '/claim/continue',
    $snapshot_data: [{ type: 4, data: { href: 'https://www.asktrusthub.com/claim/continue?auth_error=user@example.com' } }],
  });
  const nested = (props.$snapshot_data as Array<{ data: { href: string } }>)[0].data.href;
  assert.doesNotMatch(nested, /auth_error/i);
  assert.doesNotMatch(nested, /example\.com/);
});

test('autocapture element metadata ($elements, $elements_chain, $external_click_url) is sanitized', () => {
  const props = sanitizePageviewProperties({
    $pathname: '/claim/continue',
    $external_click_url: 'https://www.asktrusthub.com/claim/continue?auth_error=user@example.com',
    $elements_chain: 'a.link-inline:attr__href="/claim/continue?auth_error=user@example.com"nth-child="1"',
    $elements: [{ tag_name: 'a', attr__href: '/claim/continue?auth_error=Access%20Denied%20for%20user@example.com' }],
  });
  assert.doesNotMatch(String(props.$external_click_url), /example\.com/);
  assert.doesNotMatch(String(props.$elements_chain), /example\.com/);
  const el = (props.$elements as Array<{ attr__href: string }>)[0];
  assert.doesNotMatch(el.attr__href, /example\.com|Denied/i);
});

test('redactSensitiveParamsInText handles malformed/encoded fragments without throwing', () => {
  assert.doesNotThrow(() => redactSensitiveParamsInText('auth_error=%ZZ%not-valid-percent-encoding'));
  assert.doesNotThrow(() => redactSensitiveParamsInText(''));
  const cleaned = redactSensitiveParamsInText('href="/x?auth_error=user@example.com&ok=1" other text');
  assert.doesNotMatch(cleaned, /example\.com/);
  assert.match(cleaned, /ok=1/);
});

// ---------------------------------------------------------------- existing ATH-OBS-002C protections, not regressed
test('existing q/query/question search-text scrubbing still passes (ATH-OBS-002C)', () => {
  const url = sanitizeAnalyticsUrl('https://www.asktrusthub.com/ask?q=who%20owns%20this%20house&question=raw&query=raw2&utm_source=x');
  assert.ok(url);
  assert.doesNotMatch(url, /who%20owns|owns\+this|question=raw|query=raw2/);
  assert.match(url, /utm_source=x/);
});

test('legitimate unrelated query parameters are not destroyed alongside auth_error', () => {
  const url = sanitizeAnalyticsUrl('https://www.asktrusthub.com/claim/continue?auth_error=HANDOFF_EXPIRED&utm_campaign=spring&page=2&sort=recent');
  assert.ok(url);
  assert.match(url, /utm_campaign=spring/);
  assert.match(url, /page=2/);
  assert.match(url, /sort=recent/);
});

test('sanitizeAnalyticsUrl handles an unparseable value safely (relative text resolves against the app origin)', () => {
  assert.doesNotThrow(() => sanitizeAnalyticsUrl('not a url at all'));
  assert.equal(sanitizeAnalyticsUrl(''), undefined);
  assert.equal(sanitizeAnalyticsUrl(null), undefined);
  assert.equal(sanitizeAnalyticsUrl(undefined), undefined);
  assert.doesNotThrow(() => sanitizeAnalyticsUrl('http://[not-a-valid-ipv6'));
});

test('sanitizeAnalyticsUrl handles doubly-encoded and malformed percent-encoding in auth_error without throwing', () => {
  assert.doesNotThrow(() => sanitizeAnalyticsUrl('https://www.asktrusthub.com/claim/continue?auth_error=%25ZZ%25invalid'));
  const url = sanitizeAnalyticsUrl('https://www.asktrusthub.com/claim/continue?auth_error=user%2540example.com');
  assert.ok(url);
  assert.doesNotMatch(url, /auth_error/i);
});
