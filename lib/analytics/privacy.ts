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

/**
 * Name match, not a value blacklist. Variants (authError, auth_code, id_token, searchTerm)
 * are covered. Analytics URLs no longer forward any query string.
 */
const SENSITIVE_QUERY_KEY_PATTERN = /token|email|code|password|note|error|handoff|secret|otp|search|phone|address|ssn|authorization/i;

const MAX_URL_LENGTH = 2048;
const MAX_DECODES = 3;
const MAX_NESTED_DEPTH = 3;

function canonicalQueryKey(key: string): string {
  return key.trim().toLowerCase().replace(/-/g, '_');
}

export function isSensitiveQueryKey(key: string): boolean {
  const canonical = canonicalQueryKey(key);
  const compact = canonical.replace(/[^a-z0-9]/g, '');
  if (!compact) return true;
  return (
    SENSITIVE_QUERY_KEYS.includes(canonical as (typeof SENSITIVE_QUERY_KEYS)[number]) ||
    SENSITIVE_QUERY_KEY_PATTERN.test(canonical) ||
    SENSITIVE_QUERY_KEY_PATTERN.test(compact) ||
    compact === 'searchterm' ||
    compact === 'authcode' ||
    compact === 'idtoken'
  );
}

/** Repeated percent-decoding with a hard stop. Malformed or still-encoded input is rejected. */
function decodeBounded(value: string): string | null {
  let current = value;
  for (let attempt = 0; attempt <= MAX_DECODES; attempt += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(current)) return current;
    if (/%(?![0-9A-Fa-f]{2})/.test(current)) return null;
    try {
      const next = decodeURIComponent(current);
      if (next === current) return current;
      current = next;
    } catch {
      return null;
    }
  }
  return /%[0-9A-Fa-f]{2}/.test(current) ? null : current;
}

const privacyDiagnosticCounts = {
  dropped_event: 0,
  rejected_property: 0,
  malformed_url: 0,
};

function notePrivacyDiagnostic(kind: keyof typeof privacyDiagnosticCounts): void {
  privacyDiagnosticCounts[kind] += 1;
}

/** Counts only. Values and property names are not recorded. */
export function privacyDiagnostics(): { dropped_event: number; rejected_property: number; malformed_url: number } {
  return { ...privacyDiagnosticCounts };
}

/** A `%` that is not two hex digits is rejected before any URL parser can normalize it. */
function hasMalformedPercentEncoding(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 37) continue;
    const pair = value.slice(index + 1, index + 3);
    if (!/^[0-9A-Fa-f]{2}$/.test(pair)) return true;
    index += 2;
  }
  return false;
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
    const bare = String(properties.$pathname).split('#')[0].split('?')[0];
    properties.$pathname = bare.startsWith('/') ? publicAnalyticsPath(bare) : '/';
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

/**
 * Exact public routes only. No account, business, profile, search-text, or other
 * caller-controlled pathname segments. Anything else becomes `/`.
 */
const PUBLIC_ANALYTICS_PATHS = new Set([
  '/',
  '/ask',
  '/search',
  '/claim',
  '/privacy',
  '/privacy-policy',
  '/verify-dot',
  '/companies',
]);

function publicAnalyticsPath(rawPath: string): string {
  if (!rawPath.startsWith('/') || rawPath.includes('\\') || rawPath.includes('?') || rawPath.includes('#') || rawPath.includes('@')) {
    return '/';
  }
  if (hasMalformedPercentEncoding(rawPath) || rawPath.includes('\uFFFD')) return '/';
  const decoded = decodeBounded(rawPath);
  if (
    decoded == null
    || !decoded.startsWith('/')
    || decoded.includes('%')
    || decoded.includes('\\')
    || decoded.includes('?')
    || decoded.includes('#')
    || decoded.includes('@')
    || decoded.includes('\uFFFD')
    || decoded.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    return '/';
  }
  let path = decoded.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return PUBLIC_ANALYTICS_PATHS.has(path) ? path : '/';
}

/**
 * Fail closed. Relative inputs are rejected instead of resolved against the hub.
 * Pathnames must be an enumerated public route. Every query string and fragment is removed.
 * Malformed percent encoding drops the URL.
 */
export function sanitizeAnalyticsUrl(raw: string | undefined | null, depth = 0): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (depth > MAX_NESTED_DEPTH || trimmed.length > MAX_URL_LENGTH) return undefined;
  if (hasMalformedPercentEncoding(trimmed) || trimmed.includes('\uFFFD')) {
    notePrivacyDiagnostic('malformed_url');
    return undefined;
  }
  if (!/^https:\/\//i.test(trimmed)) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    const result = `${url.origin}${publicAnalyticsPath(url.pathname)}`;
    if (
      result.includes('?')
      || result.includes('#')
      || result.includes('@')
      || result.includes('\uFFFD')
      || hasMalformedPercentEncoding(result)
    ) {
      notePrivacyDiagnostic('malformed_url');
      return undefined;
    }
    return result;
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
    request.name = sanitizeAnalyticsUrl(request.name) ?? '/';
  }
  return request;
}

/**
 * Autocapture / link-click metadata. `$elements[].attr__href`, `$external_click_url` and the
 * serialized `$elements_chain` can each embed a full URL with its query string.
 */
const AUTOCAPTURE_URL_KEYS = ['$external_click_url', '$el_href', 'attr__href', 'attr__action', 'attr__formaction', 'attr__src'] as const;

export function redactSensitiveParamsInText(text: string): string {
  // Element chains are not parseable URLs. Drop the whole query component.
  return text.replace(/\?[^;"'\s]*/g, '');
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

const HUBS = new Set(['ask', 'move', 'lender', 'insurance', 'contractor', 'senior', 'investor']);
const ENVIRONMENTS = new Set(['production', 'preview', 'development']);
const SURFACES = new Set([
  'my_saved',
  'my_projects',
  'my_project_detail',
  'my_watches',
  'my_sign_in',
  'my_home',
  'ask_form',
  'ask_results',
  'search',
  'app_router',
  'claim',
  'homepage',
  'GUIDED',
  'ASK_SSR',
  'NAME_CANDIDATES',
  'JOURNEY',
  'move_destination',
  'move_plan_completion',
]);
const JOURNEY_ENUMS: Record<string, ReadonlySet<string>> = {
  action_source: new Set(['my_saved_form', 'guest_import', 'specialist_handoff']),
  auth_state: new Set(['guest', 'authenticated']),
  outcome: new Set(['intent', 'success', 'failure']),
  failure_reason: new Set([
    'unable',
    'handoff_unavailable',
    'import_invalid',
    'import_none_selected',
    'coverage_required',
    'invalid_email',
    'signin_unavailable',
    'link_delivery',
    'captcha_required',
    'callback_missing_code',
    'callback_exchange',
    'callback_session',
    'callback_unavailable',
    'access_restricted',
  ]),
  continuation_reason: new Set(['save_handoff', 'direct']),
  handoff_type: new Set(['contractor_save']),
};
const BOOLEAN_KEYS = new Set(['authenticated', 'success', 'project_context_present']);
/**
 * Finite analytics codes owned by the application.
 * Ask research intents, Ask result classes, guided result states, and Move
 * specialist-search intents. Unknown strings are dropped. They are not rewritten.
 */
export const CLASSIFICATION_ENUMS: Record<string, ReadonlySet<string>> = {
  capability: new Set([
    'IDENTIFIER_LOOKUP',
    'ENTITY_LOOKUP',
    'ENTITY_LOOKUP_MISSING_IDENTITY',
    'COHORT_BROWSE',
    'HOW_TO',
    'EXPLAINER',
    'COMPARE',
    'RECOMMENDATION_REQUEST',
    'MULTI_HUB_JOURNEY',
    'IDENTITY',
    'DISCOVERY',
    'EVIDENCE',
    'EXPLAIN',
    'COUNT',
    'UNKNOWN',
  ]),
  capability_state: new Set([
    'SUPPORTED_RESULTS',
    'ZERO_MATCHING_ROWS',
    'CLARIFICATION_REQUIRED',
    'INVALID_GEOGRAPHY',
    'UNSUPPORTED_STATE_CAPABILITY',
    'UNSUPPORTED_TRADE_CAPABILITY',
    'PUBLICATION_RESTRICTED',
    'EXACT_IDENTITY',
    'NO_CONFIDENT_MATCH',
    'AMBIGUOUS_IDENTITIES',
    'IDENTITY_COLLISION',
    'UNSUPPORTED_CAPABILITY',
    'INVALID_QUERY',
    'BACKEND_UNAVAILABLE',
    'TIMEOUT',
    'ROUTE_READY',
    'RESEARCH_COHORT',
    'MARKET_OR_PLACE_RESEARCH',
    'HANDOFF',
    'UNSUPPORTED_QUERY',
    'KNOWN',
    'UNKNOWN',
    'PARTIAL',
    'NOT_ACQUIRED',
    'REQUEST_ONLY',
    'UNSUPPORTED',
  ]),
  profile_type: new Set(['BUSINESS', 'moving_company']),
  provider_class: new Set(['LICENSED']),
  profile_class: new Set(['VERIFIED']),
};
const CLASSIFICATION_KEYS = new Set(Object.keys(CLASSIFICATION_ENUMS));
const STATE_CODE = /^[A-Z]{2}$/;
const PROJECT_CREDENTIAL = /^phc_[A-Za-z0-9_]{1,120}$/;
const SAFE_TITLES = new Set(['Ask Trust Hub', 'Move Trust Hub']);
const TITLE_KEYS = new Set(['title', '$title', '$document_title']);
const NESTED_BAGS = new Set(['$set', '$set_once']);
const URL_KEYS = new Set<string>(PAGE_URL_PROPERTY_KEYS);

function isIdentityPropertyKey(key: string): boolean {
  return /distinct_id|device_id|user_id|anonymous_id|person_id|session_id/i.test(key);
}

function isProjectCredential(value: unknown): value is string {
  return typeof value === 'string' && PROJECT_CREDENTIAL.test(value);
}

/** Finite types only. Objects and arrays are not accepted here. */
function acceptProperty(key: string, value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'object') return undefined;
  if (URL_KEYS.has(key)) {
    if (typeof value !== 'string') return undefined;
    const cleaned = sanitizeAnalyticsUrl(value);
    if (!cleaned || cleaned.includes('?') || cleaned.includes('#')) return undefined;
    return cleaned;
  }
  if (key === '$pathname') {
    if (typeof value !== 'string') return undefined;
    const bare = value.split('#')[0].split('?')[0];
    return bare.startsWith('/') ? publicAnalyticsPath(bare) : '/';
  }
  if (TITLE_KEYS.has(key)) {
    return typeof value === 'string' && SAFE_TITLES.has(value) ? value : undefined;
  }
  if (key === '$geoip_disable') return value === true ? true : undefined;
  if (key === 'hub' || key === 'specialist_hub') {
    return typeof value === 'string' && HUBS.has(value) ? value : undefined;
  }
  if (key === 'environment') {
    return typeof value === 'string' && ENVIRONMENTS.has(value) ? value : undefined;
  }
  if (key === 'surface') {
    return typeof value === 'string' && SURFACES.has(value) ? value : undefined;
  }
  if (key === 'state') {
    return typeof value === 'string' && STATE_CODE.test(value) ? value : undefined;
  }
  if (key === 'result_count') {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000 ? value : undefined;
  }
  if (BOOLEAN_KEYS.has(key)) return typeof value === 'boolean' ? value : undefined;
  const choices = JOURNEY_ENUMS[key];
  if (choices) return typeof value === 'string' && choices.has(value) ? value : undefined;
  if (CLASSIFICATION_KEYS.has(key)) {
    const allowed = CLASSIFICATION_ENUMS[key];
    return typeof value === 'string' && allowed.has(value) ? value : undefined;
  }
  return undefined;
}

/**
 * New object. Unknown keys, arbitrary `$` keys, arrays, and unschema'd objects are dropped.
 * Person bags cannot carry the project credential or another nested bag.
 */
function schemaProperties(bag: Record<string, unknown>, mode: 'event' | 'person'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bag)) {
    if (isIdentityPropertyKey(key)) {
      notePrivacyDiagnostic('rejected_property');
      continue;
    }
    if (key === 'token' || key === 'api_key') {
      if (mode === 'event' && isProjectCredential(value)) out[key] = value;
      else notePrivacyDiagnostic('rejected_property');
      continue;
    }
    if (NESTED_BAGS.has(key)) {
      if (mode === 'person' || !value || typeof value !== 'object' || Array.isArray(value)) {
        notePrivacyDiagnostic('rejected_property');
        continue;
      }
      const nested = schemaProperties(value as Record<string, unknown>, 'person');
      if (Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    const accepted = acceptProperty(key, value);
    if (accepted === undefined) {
      notePrivacyDiagnostic('rejected_property');
      continue;
    }
    out[key] = accepted;
  }
  return out;
}

function sealEventProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const rebuilt = schemaProperties(properties, 'event');
  for (const key of PAGE_URL_PROPERTY_KEYS) {
    const value = rebuilt[key];
    if (typeof value !== 'string' || !value.startsWith('https://') || value.includes('?') || value.includes('#')) {
      delete rebuilt[key];
    }
  }
  if (typeof rebuilt.$pathname === 'string' && (rebuilt.$pathname.includes('?') || rebuilt.$pathname.includes('#'))) {
    rebuilt.$pathname = '/';
  }
  rebuilt.$geoip_disable = true;
  delete rebuilt.$ip;
  return rebuilt;
}

function envelopeEvent(value: unknown, allowedEvents: ReadonlySet<string>): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    notePrivacyDiagnostic('dropped_event');
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.event !== 'string' || !allowedEvents.has(record.event)) {
    notePrivacyDiagnostic('dropped_event');
    return null;
  }
  const out: Record<string, unknown> = { event: record.event };
  if (record.properties == null) return out;
  if (typeof record.properties !== 'object' || Array.isArray(record.properties)) {
    notePrivacyDiagnostic('dropped_event');
    return null;
  }
  out.properties = sealEventProperties(record.properties as Record<string, unknown>);
  return out;
}

/**
 * Final capture envelope. The project credential stays only at the transport
 * slots PostHog requires. Every other field is rebuilt from the event schema.
 */
export function sanitizeCaptureEnvelope(value: unknown, allowedEvents: ReadonlySet<string>): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    notePrivacyDiagnostic('dropped_event');
    return {};
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (isProjectCredential(record.api_key)) out.api_key = record.api_key;
  else if (record.api_key !== undefined) notePrivacyDiagnostic('rejected_property');
  if (isProjectCredential(record.token)) out.token = record.token;
  else if (record.token !== undefined) notePrivacyDiagnostic('rejected_property');
  if (Array.isArray(record.batch)) {
    const events: Record<string, unknown>[] = [];
    for (const item of record.batch) {
      const event = envelopeEvent(item, allowedEvents);
      if (event) events.push(event);
    }
    if (events.length > 0) out.batch = events;
    return out;
  }
  if (Array.isArray(record.events)) {
    const events: Record<string, unknown>[] = [];
    for (const item of record.events) {
      const event = envelopeEvent(item, allowedEvents);
      if (event) events.push(event);
    }
    if (events.length > 0) out.events = events;
    return out;
  }
  if (record.event !== undefined || record.properties !== undefined) {
    const event = envelopeEvent(record, allowedEvents);
    if (!event) return out;
    return { ...out, ...event };
  }
  return out;
}

/** Allowlisted events only. Replay, exceptions, and unknown names are dropped. */
export function prepareOutboundCapture<T extends { event?: string; properties?: Record<string, unknown> } | null>(
  event: T,
  allowedEvents: ReadonlySet<string>,
): T | null {
  if (!event?.event || !allowedEvents.has(event.event)) {
    if (event) notePrivacyDiagnostic('dropped_event');
    return null;
  }
  if (event.properties != null && (typeof event.properties !== 'object' || Array.isArray(event.properties))) {
    notePrivacyDiagnostic('dropped_event');
    return null;
  }
  const sanitized = sanitizeCaptureResult(event);
  if (!sanitized) return null;
  const carrier = sanitized as T & Record<string, unknown>;
  for (const key of Object.keys(carrier)) {
    if (key !== 'event' && key !== 'properties' && isIdentityPropertyKey(key)) delete carrier[key];
  }
  if (!sanitized.properties) return sanitized;
  sanitized.properties = sealEventProperties(sanitized.properties);
  return sanitized;
}
