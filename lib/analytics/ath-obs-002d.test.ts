/**
 * ATH-OBS-002D: My TrustHub canonical event contract.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MY_TRUSTHUB_EVENTS,
  boundedJourneyProperties,
  createOnceGuard,
  decodeContinuationReason,
  encodeContinuationReason,
  resolveMyTrustHubOutcomes,
  stripConsumedMarkers,
  type MyTrustHubOutcome,
} from './my-trusthub-contract.ts';

const only = (outcomes: MyTrustHubOutcome[]) => { assert.equal(outcomes.length, 1, JSON.stringify(outcomes)); return outcomes[0]; };
const none = (path: string, qs: string) => assert.deepEqual(resolveMyTrustHubOutcomes(path, new URLSearchParams(qs)), []);

// ---------------------------------------------------------------- property allow-list
test('boundedJourneyProperties drops everything not in the closed enum lists', () => {
  const out = boundedJourneyProperties({
    surface: 'my_saved', auth_state: 'authenticated', outcome: 'success', project_context_present: true,
    // forbidden / out-of-band:
    email: 'a@b.com', note: 'private note text', bindingId: '3fa9-...-uuid', url: 'https://x/y?token=abc',
    href: '/my/saved?auth_error=leak', exception: 'TypeError: x is not a function', surface_free_text: 'anything',
    surface2: 'not-in-list', outcome_extra: 'success',
  });
  assert.deepEqual(out, { surface: 'my_saved', auth_state: 'authenticated', outcome: 'success', project_context_present: true });
});

test('boundedJourneyProperties rejects a value not present in its own enum', () => {
  assert.deepEqual(boundedJourneyProperties({ surface: 'made_up_surface', auth_state: 'authenticated' }), { auth_state: 'authenticated' });
  assert.deepEqual(boundedJourneyProperties({ failure_reason: 'SELECT * FROM users' }), {});
});

test('boundedJourneyProperties handles undefined input and non-boolean project_context_present', () => {
  assert.deepEqual(boundedJourneyProperties(undefined), {});
  assert.deepEqual(boundedJourneyProperties({ project_context_present: 'yes' }), {});
});

// ---------------------------------------------------------------- SAVE: guest and authenticated
test('SAVE SUCCESS (authenticated form): confirmed by the server-set ?saved=1 marker only', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('saved=1')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.PROFILE_SAVED);
  assert.deepEqual(o.properties, { surface: 'my_saved', action_source: 'my_saved_form', auth_state: 'authenticated', outcome: 'success' });
  assert.deepEqual(o.consumeParams, ['saved']);
});

test('SAVE FAILURE (authenticated form): server redirected with ?failed=save, not a success', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('error=unable&failed=save')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED);
  assert.equal(o.properties.outcome, 'failure');
  assert.equal(o.properties.failure_reason, 'unable');
});

test('SAVE SUCCESS via guest Save -> account continuation handoff, attributed to the specialist', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('handoff=saved')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.PROFILE_SAVED);
  assert.deepEqual(o.properties, { surface: 'my_saved', action_source: 'specialist_handoff', auth_state: 'authenticated', outcome: 'success', handoff_type: 'contractor_save', specialist_hub: 'contractor' });
});

test('SAVE FAILURE via guest handoff: an expired/consumed/tampered handoff never becomes a success', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('handoff=failed')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED);
  assert.equal(o.properties.failure_reason, 'handoff_unavailable');
});

test('SAVE via guest research import: success, failure and "nothing selected" are distinguished', () => {
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('import=complete'))).event, MY_TRUSTHUB_EVENTS.PROFILE_SAVED);
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('import=invalid'))).properties.failure_reason, 'import_invalid');
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('import=none'))).properties.failure_reason, 'import_none_selected');
});

test('project_context_present reflects whether the guest import targeted a project', () => {
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('import=complete&import_project=1'))).properties.project_context_present, true);
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('import=complete'))).properties.project_context_present, false);
});

test('no outcome fires for a plain page view of /my/saved with no marker', () => none('/my/saved', ''));

// ---------------------------------------------------------------- AUTH CONTINUATION
test('AUTH CONTINUATION START: guest Save routed to sign-in carries the reason, nothing else', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/sign-in', new URLSearchParams('continue=save')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_STARTED);
  assert.deepEqual(o.properties, { surface: 'my_sign_in', auth_state: 'guest', outcome: 'intent', continuation_reason: 'save_handoff' });
});

test('AUTH CONTINUATION COMPLETE: fires only from the callback-set ?auth=complete marker on /my', () => {
  const o = only(resolveMyTrustHubOutcomes('/my', new URLSearchParams('auth=complete'), { continuationReason: 'save_handoff' }));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_COMPLETED);
  assert.equal(o.properties.continuation_reason, 'save_handoff');
});

test('AUTH CONTINUATION COMPLETE defaults to "direct" when no continuation reason was recorded', () => {
  assert.equal(only(resolveMyTrustHubOutcomes('/my', new URLSearchParams('auth=complete'))).properties.continuation_reason, 'direct');
});

test('AUTH CONTINUATION FAILED covers every sign-in and callback failure code, and access rejection', () => {
  const cases: [string, string][] = [
    ['error=invalid', 'invalid_email'], ['error=unavailable', 'signin_unavailable'], ['error=delivery', 'link_delivery'], ['error=captcha', 'captcha_required'],
    ['error=callback_missing_code', 'callback_missing_code'], ['error=callback_exchange', 'callback_exchange'],
    ['error=callback_session', 'callback_session'], ['error=callback_unavailable', 'callback_unavailable'],
  ];
  for (const [qs, reason] of cases) {
    const o = only(resolveMyTrustHubOutcomes('/my/sign-in', new URLSearchParams(qs)));
    assert.equal(o.event, MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_FAILED, qs);
    assert.equal(o.properties.failure_reason, reason, qs);
  }
  assert.equal(only(resolveMyTrustHubOutcomes('/my/sign-in', new URLSearchParams('access=restricted'))).properties.failure_reason, 'access_restricted');
});

test('an unrecognized sign-in error code falls back to a generic failure reason, never forwarded verbatim', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/sign-in', new URLSearchParams('error=something_new_and_unmapped')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_FAILED);
  assert.equal(o.properties.failure_reason, 'unable');
  assert.equal(Object.values(o.properties).includes('something_new_and_unmapped' as never), false);
});

test('no outcome fires for a plain /my/sign-in view with no error or continue marker', () => none('/my/sign-in', 'sent=1'));

// ---------------------------------------------------------------- PROJECT / WATCH
test('PROJECT ADD (create): success only from the server-set ?created=1 marker on the project detail route', () => {
  const path = '/my/projects/3fa85f64-5717-4562-b3fc-2c963f66afa6';
  const o = only(resolveMyTrustHubOutcomes(path, new URLSearchParams('created=1')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.PROJECT_CREATED);
  assert.equal(o.properties.surface, 'my_project_detail');
  none(path, 'updated=1');
});

test('PROJECT ADD (create) failure', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/projects', new URLSearchParams('error=unable&failed=project')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.PROJECT_CREATE_FAILED);
});

test('WATCH CREATE success and the two distinguishable failure reasons', () => {
  assert.equal(only(resolveMyTrustHubOutcomes('/my/watches', new URLSearchParams('started=1'))).event, MY_TRUSTHUB_EVENTS.WATCH_CREATED);
  assert.equal(only(resolveMyTrustHubOutcomes('/my/watches', new URLSearchParams('error=coverage-required&failed=watch'))).properties.failure_reason, 'coverage_required');
  assert.equal(only(resolveMyTrustHubOutcomes('/my/watches', new URLSearchParams('error=unable&failed=watch'))).properties.failure_reason, 'unable');
});

// ---------------------------------------------------------------- idempotency / no double-capture
test('the SAME marker on the SAME URL is captured once by the once-guard (React Strict Mode double effect)', () => {
  const once = createOnceGuard();
  const key = 'profile_saved|/my/saved?saved=1';
  assert.equal(once(key, 1000), true);
  assert.equal(once(key, 1000), false, 'a second call within the window must not re-count');
  assert.equal(once(key, 1000 + 3000), true, 'a genuinely later action on the same marker DOES count again');
});

test('marker stripping removes only the consumed keys and preserves every other parameter', () => {
  assert.equal(stripConsumedMarkers('?saved=1&utm_source=newsletter', ['saved']), '?utm_source=newsletter');
  assert.equal(stripConsumedMarkers('?handoff=saved', ['handoff']), '');
  assert.equal(stripConsumedMarkers('?import=complete&import_project=1', ['import', 'import_project']), '');
});

test('refresh/Back cannot re-fire an outcome because the marker itself is gone after capture', () => {
  const first = resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('saved=1'));
  assert.equal(first.length, 1);
  const strippedSearch = stripConsumedMarkers('?saved=1', first[0].consumeParams);
  const second = resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams(strippedSearch));
  assert.deepEqual(second, []);
});

// ---------------------------------------------------------------- cross-entity / cross-surface leakage
test('a marker never fires outside the exact surface path it belongs to', () => {
  none('/my/projects', 'saved=1');
  none('/my/watches', 'created=1');
  none('/my', 'saved=1');
  none('/my/saved', 'started=1');
});

test('multiple simultaneous markers on one URL each produce their own event with their own consumeParams', () => {
  const outcomes = resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('failed=save&error=unable&import=none'));
  assert.equal(outcomes.length, 2);
  assert.deepEqual(outcomes.map((o) => o.event).sort(), [MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED, MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED].sort());
});

// ---------------------------------------------------------------- continuation-reason storage codec
test('continuation reason round-trips through the bounded storage codec and expires', () => {
  const encoded = encodeContinuationReason('save_handoff', 1_000_000);
  assert.equal(decodeContinuationReason(encoded, 1_000_000 + 1000), 'save_handoff');
  assert.equal(decodeContinuationReason(encoded, 1_000_000 + 60 * 60 * 1000 + 1), null, 'expired after the TTL');
  assert.equal(decodeContinuationReason(null, 1_000_000), null);
  assert.equal(decodeContinuationReason('not-an-enum:1000', 1_000_000), null);
  assert.equal(encodeContinuationReason('anything-else', 1_000_000), null);
  assert.equal(decodeContinuationReason('save_handoff:not-a-number', 1_000_000), null);
});

// ---------------------------------------------------------------- pathname edge cases
test('a trailing slash and a querystring embedded in pathname do not change the surface match', () => {
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved/', new URLSearchParams('saved=1'))).event, MY_TRUSTHUB_EVENTS.PROFILE_SAVED);
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved?ignored=1', new URLSearchParams('saved=1'))).event, MY_TRUSTHUB_EVENTS.PROFILE_SAVED);
});

test('the project-detail route pattern requires a UUID segment, not an arbitrary path', () => {
  none('/my/projects/not-a-uuid', 'created=1');
  none('/my/projects', 'created=1');
});
