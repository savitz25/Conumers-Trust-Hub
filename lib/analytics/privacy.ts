/**
 * AskTrustHub analytics privacy. Never send raw search text, PII, tokens, or notes.
 */

export const SENSITIVE_QUERY_KEYS = [
  'q',
  'query',
  'question',
  'email',
  'token',
  'code',
  'password',
  'access_token',
  'refresh_token',
  'session',
  'note',
  'notes',
  'body',
  'message',
  'otp',
] as const;

export const FORBIDDEN_EVENT_KEYS = [
  'q',
  'query',
  'question',
  'email',
  'name',
  'first_name',
  'last_name',
  'phone',
  'address',
  'ssn',
  'password',
  'token',
  'authorization',
  'cookie',
  'nmls',
  'usdot',
  'ccn',
  'crd',
  'npn',
  'note',
  'notes',
  'body',
  'message',
  'href',
  'url',
  'search',
  'entityName',
  'identifierValue',
] as const;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOpaqueTrustHubId(value: string): boolean {
  return UUID.test(value.trim());
}

/** SDK/ingest fields. Stripping `token` makes posthog-js drop the event (401). */
export const POSTHOG_RESERVED_KEYS = [
  'token',
  'distinct_id',
  'timestamp',
  'uuid',
  'event',
  'offset',
  'api_key',
] as const;

export function isPosthogReservedKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (lower.startsWith('$')) return true;
  return (POSTHOG_RESERVED_KEYS as readonly string[]).includes(lower);
}

export function sanitizePageviewProperties(properties: Record<string, unknown>): Record<string, unknown> {
  if (typeof properties.$current_url === 'string') {
    properties.$current_url = sanitizeAnalyticsUrl(properties.$current_url);
  }
  if (typeof properties.$pathname === 'string') {
    properties.$pathname = String(properties.$pathname).split('?')[0];
  }
  if (typeof properties.$referrer === 'string') {
    properties.$referrer = sanitizeAnalyticsUrl(properties.$referrer);
  }
  const path = String(properties.$pathname || properties.$current_url || '');
  if (path.includes('/ask') || path.includes('/search')) {
    properties.$title = 'Ask Trust Hub';
    properties.title = 'Ask Trust Hub';
    properties.$document_title = 'Ask Trust Hub';
  }
  for (const key of Object.keys(properties)) {
    if (isPosthogReservedKey(key)) continue;
    if (FORBIDDEN_EVENT_KEYS.includes(key.toLowerCase() as (typeof FORBIDDEN_EVENT_KEYS)[number])) {
      delete properties[key];
    }
  }
  return properties;
}

export function sanitizeCaptureResult<T extends { event?: string; properties?: Record<string, unknown> } | null>(
  event: T,
): T {
  if (!event) return event;
  if (event.properties) sanitizePageviewProperties(event.properties);
  return event;
}

export function sanitizeAnalyticsUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, 'https://www.asktrusthub.com');
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.includes(key.toLowerCase() as (typeof SENSITIVE_QUERY_KEYS)[number]) || /token|email|code|password|note/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = '';
    url.username = '';
    url.password = '';
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

export function stripForbiddenProperties(
  props: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const cleaned: Record<string, string | number | boolean> = {};
  if (!props) return cleaned;
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_EVENT_KEYS.includes(lower as (typeof FORBIDDEN_EVENT_KEYS)[number])) continue;
    if (/email|password|token|ssn|phone|nmls|usdot|ccn|crd/.test(lower)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
