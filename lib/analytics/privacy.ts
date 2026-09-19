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
  // ATH-OBS-002E: error / continuation carriers. Values may hold provider text, an email or a token.
  'auth_error',
  'error',
  'error_code',
  'error_description',
  'error_uri',
  'handoff',
] as const;

/** Substring match on the parameter NAME, so variants (authError, x_error_msg, id_token, signup_code) are covered too. */
const SENSITIVE_QUERY_KEY_PATTERN = /token|email|code|password|note|error|handoff|secret|otp/i;

export function isSensitiveQueryKey(key: string): boolean {
  return SENSITIVE_QUERY_KEYS.includes(key.toLowerCase() as (typeof SENSITIVE_QUERY_KEYS)[number]) || SENSITIVE_QUERY_KEY_PATTERN.test(key);
}

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
  'auth_error',
  'error',
  'error_message',
  'error_description',
  'project_id',
  'projectId',
  'handoff',
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

const PAGE_URL_PROPERTY_KEYS = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$session_entry_url',
  '$entry_current_url',
  '$initial_referrer',
  '$session_entry_referrer',
  '$prev_pageview_url',
] as const;

function sanitizeUrlProperties(target: Record<string, unknown>): void {
  for (const key of PAGE_URL_PROPERTY_KEYS) {
    if (typeof target[key] === 'string') target[key] = sanitizeAnalyticsUrl(target[key] as string);
  }
}

/** Interpretation / echo labels that restate the user's Ask query or requested geography. */
const ASK_REPLAY_MASKED_ECHO_LABELS = new Set([
  'you asked',
  'research executed',
  'requested location',
  'requested geography',
  'recorded geography',
  'location',
  'topic',
  'situation',
]);

export function isAskReplayMaskedEchoLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'source geography' || normalized === 'geography scope') return false;
  if (ASK_REPLAY_MASKED_ECHO_LABELS.has(normalized)) return true;
  return normalized.startsWith('geography');
}

export function sanitizePageviewProperties(properties: Record<string, unknown>): Record<string, unknown> {
  sanitizeUrlProperties(properties);
  // Person properties travel inside the event: `$set_once.$initial_current_url` is a second copy of the landing URL.
  for (const bag of ['$set', '$set_once']) {
    const nested = properties[bag];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) sanitizeUrlProperties(nested as Record<string, unknown>);
  }
  if (typeof properties.$pathname === 'string') {
    properties.$pathname = String(properties.$pathname).split('?')[0];
  }
  sanitizeReplaySnapshotHrefs(properties.$snapshot_data);
  sanitizeAutocaptureUrls(properties);
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
      if (isSensitiveQueryKey(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    url.username = '';
    url.password = '';
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

/**
 * PostHog Session Replay uses this callback for network URLs *and* the page URL
 * stored as recording `start_url` / player footer href (rrweb Meta events).
 */
export function sanitizeCapturedNetworkRequest<T extends { name?: string }>(request: T): T {
  if (typeof request.name === 'string') {
    request.name = sanitizeAnalyticsUrl(request.name) ?? request.name.replace(/\?[^#]*/, '');
  }
  return request;
}

/**
 * Autocapture / link-click metadata. `$elements[].attr__href`, `$external_click_url` and the
 * serialized `$elements_chain` can each embed a full URL with its query string.
 */
const AUTOCAPTURE_URL_KEYS = ['$external_click_url', '$el_href', 'attr__href', 'attr__action', 'attr__formaction', 'attr__src'] as const;

export function redactSensitiveParamsInText(text: string): string {
  // name=value pairs inside arbitrary text (a serialized element chain is not a parseable URL).
  return text.replace(/([?&]|&amp;)([^=&;"'\s]+)=([^&;"'\s]*)/g, (match, lead: string, key: string) => {
    let decoded = key; try { decoded = decodeURIComponent(key); } catch { /* keep raw name */ }
    return isSensitiveQueryKey(decoded) ? `${lead}${key}=[redacted]` : match;
  });
}

function sanitizeAutocaptureUrls(properties: Record<string, unknown>): void {
  for (const key of AUTOCAPTURE_URL_KEYS) {
    if (typeof properties[key] === 'string') properties[key] = sanitizeAnalyticsUrl(properties[key] as string) ?? '[redacted]';
  }
  if (typeof properties.$elements_chain === 'string') properties.$elements_chain = redactSensitiveParamsInText(properties.$elements_chain);
  if (Array.isArray(properties.$elements)) {
    for (const element of properties.$elements) {
      if (!element || typeof element !== 'object') continue;
      const record = element as Record<string, unknown>;
      for (const key of AUTOCAPTURE_URL_KEYS) {
        if (typeof record[key] === 'string') record[key] = sanitizeAnalyticsUrl(record[key] as string) ?? '[redacted]';
      }
      if (typeof record.href === 'string') record.href = sanitizeAnalyticsUrl(record.href) ?? '[redacted]';
    }
  }
}

function sanitizeReplaySnapshotHrefs(node: unknown, depth = 0): void {
  if (depth > 8 || node == null) return;
  if (typeof node === 'string') return;
  if (Array.isArray(node)) {
    for (const item of node) sanitizeReplaySnapshotHrefs(item, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.href === 'string') {
    const cleaned = sanitizeAnalyticsUrl(obj.href);
    if (cleaned) obj.href = cleaned;
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') sanitizeReplaySnapshotHrefs(value, depth + 1);
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
