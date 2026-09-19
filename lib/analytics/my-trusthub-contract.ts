/**
 * ATH-OBS-002D: canonical My TrustHub journey event contract (PostHog).
 *
 * ONE semantic action = ONE event. INTENT events fire when the customer acts; SUCCESS / FAILURE
 * events fire only from an outcome the SERVER confirmed after its mutation finished, carried to the
 * browser as a bounded marker on the redirect URL. Nothing here reads user content: every property
 * value is a member of a closed enum or a boolean. Anything else is dropped.
 *
 * Pure module (no React / DOM / PostHog import) so the contract is unit-testable.
 * Human-readable contract: docs/analytics/posthog-ask-event-contract.md
 */

export const MY_TRUSTHUB_EVENTS = {
  PROFILE_SAVE_INTENT: 'profile_save_intent',
  /** Pre-existing name. Now emitted only after a confirmed Save. */
  PROFILE_SAVED: 'profile_saved',
  PROFILE_SAVE_FAILED: 'profile_save_failed',
  AUTH_CONTINUATION_STARTED: 'auth_continuation_started',
  AUTH_CONTINUATION_COMPLETED: 'auth_continuation_completed',
  AUTH_CONTINUATION_FAILED: 'auth_continuation_failed',
  /** Pre-existing name. Now emitted only after a confirmed create. */
  PROJECT_CREATED: 'project_created',
  PROJECT_CREATE_FAILED: 'project_create_failed',
  PROJECT_ITEM_ADDED: 'project_item_added',
  WATCH_CREATED: 'watch_created',
  WATCH_CREATE_FAILED: 'watch_create_failed',
} as const;

export type MyTrustHubEventName = (typeof MY_TRUSTHUB_EVENTS)[keyof typeof MY_TRUSTHUB_EVENTS];

/** Closed vocabularies. A value outside its list is never sent. */
export const MY_TRUSTHUB_PROPERTY_ENUMS = {
  surface: ['my_saved', 'my_projects', 'my_project_detail', 'my_watches', 'my_sign_in', 'my_home'],
  action_source: ['my_saved_form', 'guest_import', 'specialist_handoff'],
  auth_state: ['guest', 'authenticated'],
  outcome: ['intent', 'success', 'failure'],
  failure_reason: [
    'unable', 'handoff_unavailable', 'import_invalid', 'import_none_selected', 'coverage_required',
    'invalid_email', 'signin_unavailable', 'link_delivery', 'captcha_required',
    'callback_missing_code', 'callback_exchange', 'callback_session', 'callback_unavailable', 'access_restricted',
  ],
  continuation_reason: ['save_handoff', 'direct'],
  handoff_type: ['contractor_save'],
  specialist_hub: ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'],
} as const;

const BOOLEAN_PROPERTIES = ['project_context_present'] as const;

export type MyTrustHubEventProperties = Partial<{
  surface: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.surface)[number];
  action_source: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.action_source)[number];
  auth_state: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.auth_state)[number];
  outcome: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.outcome)[number];
  failure_reason: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.failure_reason)[number];
  continuation_reason: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.continuation_reason)[number];
  handoff_type: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.handoff_type)[number];
  specialist_hub: (typeof MY_TRUSTHUB_PROPERTY_ENUMS.specialist_hub)[number];
  project_context_present: boolean;
}>;

/**
 * The ONLY way journey properties are built: allow-list by key, then by enum value. Unknown keys,
 * non-enum strings, numbers, objects, ids, URLs and free text cannot pass.
 */
export function boundedJourneyProperties(input: Record<string, unknown> | undefined): MyTrustHubEventProperties {
  const output: Record<string, string | boolean> = {};
  if (!input) return output;
  for (const [key, allowed] of Object.entries(MY_TRUSTHUB_PROPERTY_ENUMS)) {
    const value = input[key];
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) output[key] = value;
  }
  for (const key of BOOLEAN_PROPERTIES) if (typeof input[key] === 'boolean') output[key] = input[key] as boolean;
  return output as MyTrustHubEventProperties;
}

export type MyTrustHubOutcome = {
  event: MyTrustHubEventName;
  properties: MyTrustHubEventProperties;
  /** One-shot URL markers to remove after capture so refresh / Back cannot re-count the conversion. */
  consumeParams: string[];
};

const SIGN_IN_FAILURES: Record<string, (typeof MY_TRUSTHUB_PROPERTY_ENUMS.failure_reason)[number]> = {
  invalid: 'invalid_email', unavailable: 'signin_unavailable', delivery: 'link_delivery', captcha: 'captcha_required',
  callback_missing_code: 'callback_missing_code', callback_exchange: 'callback_exchange', callback_session: 'callback_session', callback_unavailable: 'callback_unavailable',
};

const normalizePath = (pathname: string) => (pathname.split('?')[0].replace(/\/+$/, '') || '/');
const PROJECT_DETAIL = /^\/my\/projects\/[0-9a-f-]{36}$/i;

/**
 * Map a server-confirmed outcome marker to its canonical event. Returns every outcome present
 * (normally zero or one). Marker VALUES are matched against literals; they are never forwarded.
 */
export function resolveMyTrustHubOutcomes(pathname: string, params: URLSearchParams, context: { continuationReason?: string | null } = {}): MyTrustHubOutcome[] {
  const path = normalizePath(pathname);
  const outcomes: MyTrustHubOutcome[] = [];
  const add = (event: MyTrustHubEventName, properties: Record<string, unknown>, consumeParams: string[]) => outcomes.push({ event, properties: boundedJourneyProperties(properties), consumeParams });
  const authed = { auth_state: 'authenticated' };

  if (path === '/my/saved') {
    const saved = { ...authed, surface: 'my_saved', outcome: 'success' }; const failed = { ...authed, surface: 'my_saved', outcome: 'failure' };
    if (params.get('handoff') === 'saved') add(MY_TRUSTHUB_EVENTS.PROFILE_SAVED, { ...saved, action_source: 'specialist_handoff', handoff_type: 'contractor_save', specialist_hub: 'contractor' }, ['handoff']);
    else if (params.get('handoff') === 'failed') add(MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED, { ...failed, action_source: 'specialist_handoff', handoff_type: 'contractor_save', specialist_hub: 'contractor', failure_reason: 'handoff_unavailable' }, ['handoff']);
    if (params.get('saved') === '1') add(MY_TRUSTHUB_EVENTS.PROFILE_SAVED, { ...saved, action_source: 'my_saved_form' }, ['saved']);
    if (params.get('failed') === 'save') add(MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED, { ...failed, action_source: 'my_saved_form', failure_reason: 'unable' }, ['failed', 'error']);
    const imported = params.get('import');
    // V2-2 cutover: import success is emitted from the durable action receipt,
    // never from an old/bookmarked/forged import=complete URL.
    if (imported === 'invalid') add(MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED, { ...failed, action_source: 'guest_import', failure_reason: 'import_invalid' }, ['import']);
    else if (imported === 'none') add(MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED, { ...failed, action_source: 'guest_import', failure_reason: 'import_none_selected' }, ['import']);
  }
  if (PROJECT_DETAIL.test(path) && params.get('created') === '1') add(MY_TRUSTHUB_EVENTS.PROJECT_CREATED, { ...authed, surface: 'my_project_detail', outcome: 'success' }, ['created']);
  if (path === '/my/projects' && params.get('failed') === 'project') add(MY_TRUSTHUB_EVENTS.PROJECT_CREATE_FAILED, { ...authed, surface: 'my_projects', outcome: 'failure', failure_reason: 'unable' }, ['failed', 'error']);
  if (path === '/my/watches') {
    if (params.get('started') === '1') add(MY_TRUSTHUB_EVENTS.WATCH_CREATED, { ...authed, surface: 'my_watches', outcome: 'success' }, ['started']);
    else if (params.get('failed') === 'watch') add(MY_TRUSTHUB_EVENTS.WATCH_CREATE_FAILED, { ...authed, surface: 'my_watches', outcome: 'failure', failure_reason: params.get('error') === 'coverage-required' ? 'coverage_required' : 'unable' }, ['failed', 'error']);
  }
  if (path === '/my/sign-in') {
    const guest = { auth_state: 'guest', surface: 'my_sign_in' };
    if (params.get('continue') === 'save') add(MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_STARTED, { ...guest, outcome: 'intent', continuation_reason: 'save_handoff' }, ['continue']);
const errorParam = params.get('error');
    const reason = params.get('access') === 'restricted' ? 'access_restricted' : errorParam ? (SIGN_IN_FAILURES[errorParam] ?? 'unable') : null;
    if (reason) add(MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_FAILED, { ...guest, outcome: 'failure', failure_reason: reason }, ['error', 'access']);
  }
  if (['/my', '/my/saved', '/my/projects', '/my/you'].includes(path) && params.get('auth') === 'complete') {
    add(MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_COMPLETED, { ...authed, surface: 'my_home', outcome: 'success', continuation_reason: context.continuationReason === 'save_handoff' ? 'save_handoff' : 'direct' }, ['auth']);
  }
  return outcomes;
}

/** Remove consumed one-shot markers; every other parameter is preserved in order. */
export function stripConsumedMarkers(search: string, consume: readonly string[]): string {
  const params = new URLSearchParams(search);
  for (const key of consume) params.delete(key);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/**
 * In-memory guard against React Strict Mode double effects and re-renders: the same outcome on the
 * same URL is emitted once within a short window. The window is short on purpose -- a customer who
 * genuinely repeats an action later lands on the same marker URL and MUST be counted again.
 * (Refresh / Back are handled separately, by stripping the marker.)
 */
export const DUPLICATE_WINDOW_MS = 2000;
export function createOnceGuard(windowMs = DUPLICATE_WINDOW_MS): (key: string, now?: number) => boolean {
  const seen = new Map<string, number>();
  return (key, now = Date.now()) => {
    const last = seen.get(key);
    if (last !== undefined && now - last < windowMs) return false;
    seen.set(key, now);
    return true;
  };
}

/** Bounded, enum-only memory of WHY sign-in started, so completion can be attributed after the email round-trip. */
export const CONTINUATION_REASON_STORAGE_KEY = 'ath_auth_continuation_reason';
export const CONTINUATION_REASON_TTL_MS = 60 * 60 * 1000;
export function encodeContinuationReason(reason: string, now: number): string | null {
  return (MY_TRUSTHUB_PROPERTY_ENUMS.continuation_reason as readonly string[]).includes(reason) ? `${reason}:${now}` : null;
}
export function decodeContinuationReason(stored: string | null | undefined, now: number): string | null {
  if (!stored) return null;
  const [reason, at] = stored.split(':'); const time = Number(at);
  if (!(MY_TRUSTHUB_PROPERTY_ENUMS.continuation_reason as readonly string[]).includes(reason)) return null;
  if (!Number.isFinite(time) || now - time > CONTINUATION_REASON_TTL_MS || now < time) return null;
  return reason;
}
