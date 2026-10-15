/**
 * ATH-OBS-002D: My TrustHub canonical event contract.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as journeyContract from './my-trusthub-contract.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';
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

test('V2-2: guest import success requires a receipt, while legacy failure markers stay bounded', () => {
  none('/my/saved', 'import=complete');
  assert.equal(only(resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('import=invalid'))).properties.failure_reason, 'import_invalid');
  none('/my/saved', 'import=none');
});

test('V2-2: a project marker cannot manufacture a durable import outcome', () => {
  none('/my/saved', 'import=complete&import_project=1');
  none('/my/saved', 'import=complete');
});

test('no outcome fires for a plain page view of /my/saved with no marker', () => none('/my/saved', ''));

// ---------------------------------------------------------------- AUTH CONTINUATION
test('AUTH CONTINUATION START: guest Save routed to sign-in carries the reason, nothing else', () => {
  const o = only(resolveMyTrustHubOutcomes('/my/sign-in', new URLSearchParams('continue=save')));
  assert.equal(o.event, MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_STARTED);
  assert.deepEqual(o.properties, { surface: 'my_sign_in', auth_state: 'guest', outcome: 'intent', continuation_reason: 'save_handoff' });
});

test('V2-2R forged auth completion marker is not a verified authentication receipt', () => {
  assert.deepEqual(resolveMyTrustHubOutcomes('/my', new URLSearchParams('auth=complete'), { continuationReason: 'save_handoff' }), []);
});

test('V2-2R bookmarked completion marker cannot manufacture a direct login event', () => {
  assert.deepEqual(resolveMyTrustHubOutcomes('/my', new URLSearchParams('auth=complete')), []);
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
  const outcomes = resolveMyTrustHubOutcomes('/my/saved', new URLSearchParams('failed=save&error=unable&import=invalid'));
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

// Run the actual client handlers with isolated hooks, server actions and transport.
// No account, database, browser SDK or live analytics call is involved.
function clientModule(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(code, {
    exports, URLSearchParams,
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected fixture import: ${name}`);
      return modules[name];
    },
    ...globals,
  });
  return exports;
}

type Capture = { event: string; properties: Record<string, unknown> };
function mockTransport() {
  const events: Capture[] = [];
  return { events, captureTrustEvent: (event: string, properties: Record<string, unknown>) => {
    events.push({ event, properties: JSON.parse(JSON.stringify(properties)) });
  } };
}

test('actual outcome effect captures Save failure and Unsave once, consumes markers, and counts immediate retries', () => {
  const transport = mockTransport();
  let enabled = true;
  let snapshot = '';
  const location = { pathname: '/my/saved', search: '' };
  const history = { state: null, replaceState: (_state: unknown, _title: string, url: string) => {
    location.search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  } };
  const outcomeModule = clientModule('components/analytics/my-trusthub-outcomes.tsx', {
    react: { useEffect: (effect: () => void) => effect() },
    'next/navigation': { usePathname: () => location.pathname, useSearchParams: () => new URLSearchParams(snapshot) },
    '@/lib/analytics/environment': { shouldEnablePosthog: () => enabled },
    '@/lib/analytics/trusthub': transport,
    '@/lib/analytics/my-trusthub-contract': journeyContract,
  }, { window: { location, history, localStorage: { getItem: () => null } } });
  const effect = outcomeModule.MyTrustHubOutcomes as () => void;
  const navigate = (search: string) => { snapshot = search; location.search = search; effect(); effect(); };
  navigate('?saved=1');
  assert.deepEqual(transport.events.map(x => x.event), ['profile_saved']);
  navigate('?failed=save&error=unable');
  navigate('?failed=save&error=unable'); // genuine retry, no artificial two-second wait
  assert.equal(transport.events.filter(x => x.event === 'profile_save_failed').length, 2);
  navigate('?unsaved=1&utm_source=fixture');
  assert.equal(transport.events.filter(x => x.event === 'profile_unsaved').length, 1);
  assert.equal(location.search, '?utm_source=fixture');
  navigate(location.search); // refresh after consumption
  assert.equal(transport.events.length, 4);
  assert.deepEqual(transport.events[3].properties, {
    surface: 'my_saved', action_source: 'my_saved_form', auth_state: 'authenticated', outcome: 'success',
  });
  navigate('?error=unsave');
  navigate('?unsaved=1&error=unsave');
  navigate('?import=none');
  navigate('?outcome=local_only');
  assert.equal(transport.events.length, 4, 'no success for failed Unsave; cancellation/local-only is not a failed Save');
  enabled = false;
  navigate('?unsaved=1');
  assert.equal(location.search, '?unsaved=1');
  assert.equal(transport.events.length, 4, 'analytics gate remains respected');
});

type FixtureElement = { type: string; props: { children?: unknown; onClick?: () => void; action?: (form: FormData) => void } };
function element(tree: unknown, type: string): FixtureElement | undefined {
  if (!tree || typeof tree !== 'object') return undefined;
  if (Array.isArray(tree)) return tree.map(node => element(node, type)).find(Boolean);
  const node = tree as FixtureElement;
  return node.type === type ? node : element(node.props?.children, type);
}

type ImportResult = { ok: boolean; error?: string; acknowledgment?: { itemIds: string[] } };
async function guestFixture(commit: () => Promise<ImportResult>, options: { sessions?: boolean; storageFailsAfterCommit?: boolean } = {}) {
  const transport = mockTransport();
  const states: unknown[] = [];
  let cursor = 0;
  let work = Promise.resolve();
  let committed = false;
  let calls = 0;
  const react = {
    useEffect: (effect: () => void) => effect(),
    useRef: () => ({ current: null }),
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value: unknown) => { states[index] = value; }];
    },
    useTransition: () => [false, (action: () => Promise<void>) => { work = action(); }],
  };
  const shared = {
    react,
    '@/lib/analytics/trusthub': transport,
    '@/lib/analytics/trusthub-events': { TRUSTHUB_EVENTS },
    '@/lib/analytics/my-trusthub-contract': journeyContract,
  };
  const instrumentation = clientModule('components/analytics/ask-instrumentation.tsx', shared);
  const commitAction = async () => { calls++; const result = await commit(); committed = result.ok; return result; };
  const previewAction = async () => ({ ok: true, items: [{ client_item_id: 'private-item-fixture', item_status: 'new', importable: true }] });
  const jsx = (type: string, props: FixtureElement['props']) => ({ type, props });
  const guestModule = clientModule('components/my-trusthub/guest-import.tsx', {
    ...shared,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { useRouter: () => ({ refresh: () => {} }) },
    '@/app/my/actions': { commitGuestImportAction: commitAction, commitGuestSessionImportAction: commitAction, previewGuestImportAction: previewAction, previewGuestSessionImportAction: previewAction },
    '@/lib/my-trusthub/guest-retirement': { importRequestKey: async () => 'private-request-fixture' },
    '@/components/analytics/ask-instrumentation': instrumentation,
  }, { localStorage: { getItem: () => {
    if (committed && options.storageFailsAfterCommit) throw new Error('Fixture storage refused');
    return '{"email":"private@example.invalid","token":"fixture-secret","body":"private research"}';
  } } });
  const render = () => {
    cursor = 0;
    return (guestModule.GuestImport as (props: unknown) => unknown)({
      storageKey: 'fixture', sessions: options.sessions ?? false, projects: [], ownerId: 'private-owner-fixture', ownerLabel: 'private@example.invalid',
    });
  };
  render(); // storage hydration
  const inspect = element(render(), 'button')?.props.onClick;
  assert.ok(inspect);
  inspect(); await work;
  const submit = element(render(), 'form')?.props.action;
  assert.ok(submit);
  return { events: transport.events, calls: () => calls, submit: async (selected = true) => {
    const form = new FormData();
    if (selected) form.set('selectedItemId', 'private-item-fixture');
    form.set('projectId', 'private-project-fixture');
    submit(form); await work;
  } };
}

const acknowledged = { ok: true, acknowledgment: { itemIds: ['private-item-fixture'] } };

test('guest profile Save success emits no failure, even if subsequent device read fails', async () => {
  for (const storageFailsAfterCommit of [false, true]) {
    const fixture = await guestFixture(async () => acknowledged, { storageFailsAfterCommit });
    await fixture.submit();
    assert.deepEqual(fixture.events.map(x => x.event), ['profile_save_intent', 'profile_saved']);
  }
});

test('rejected and thrown guest profile Save each emit exactly one failure with safe matching context', async () => {
  for (const commit of [
    async () => ({ ok: false, error: 'private@example.invalid fixture-secret' }),
    async () => { throw new Error('private@example.invalid fixture-secret'); },
    async () => ({ ok: true }), // missing receipt is not confirmed success
  ]) {
    const fixture = await guestFixture(commit);
    await fixture.submit();
    assert.deepEqual(fixture.events.map(x => x.event), ['profile_save_intent', 'profile_save_failed']);
    assert.deepEqual(fixture.events[1].properties, {
      surface: 'my_saved', action_source: 'guest_import', auth_state: 'authenticated', outcome: 'failure', failure_reason: 'unable', project_context_present: true,
    });
    assert.doesNotMatch(JSON.stringify(fixture.events), /private|fixture-secret|email|token|payload|body|ownerId|projectId|itemIds/);
  }
});

test('guest selection cancellation and session import are not profile Save failures', async () => {
  const empty = await guestFixture(async () => ({ ok: false }));
  await empty.submit(false);
  assert.equal(empty.calls(), 0);
  assert.deepEqual(empty.events, []);
  const session = await guestFixture(async () => ({ ok: false }), { sessions: true });
  await session.submit();
  assert.deepEqual(session.events, []);
});

test('failed guest Save then successful retry emits one event per outcome without duplicate failures', async () => {
  let attempt = 0;
  const fixture = await guestFixture(async () => ++attempt === 1 ? { ok: false } : acknowledged);
  await fixture.submit();
  await fixture.submit();
  assert.equal(fixture.calls(), 2);
  assert.deepEqual(fixture.events.map(x => x.event), ['profile_save_intent', 'profile_save_failed', 'profile_save_intent', 'profile_saved']);
});
