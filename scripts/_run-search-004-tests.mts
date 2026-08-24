/**
 * ASK-SEARCH-004 — adapter + handoff acceptance tests (expanded).
 */
import { parseUniversalSearchQuery } from '../lib/search/parser';
import {
  SEARCH_HANDOFF_KEYS,
  buildSearchBackLabel,
  intentToHandoffContext,
  parseHandoffContext,
  serializeHandoffContext,
} from '../lib/search/handoff';
import {
  HUB_SEARCH_ADAPTERS,
  buildEntityHandoff,
  buildViewMoreHandoff,
  listHubSearchAdapters,
  resolveViewMoreDestination,
  resolveEntityDestination,
} from '../lib/search/adapters';
import type { NetworkDiscoveryEntity } from '../lib/search/adapters/types';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('PASS:', msg);
  }
}

function vm(q: string) {
  return resolveViewMoreDestination(parseUniversalSearchQuery(q));
}

// --- Registry ---
assert(listHubSearchAdapters().length === 6, 'six adapters registered');
for (const h of ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'] as const) {
  assert(!!HUB_SEARCH_ADAPTERS[h], `adapter exists: ${h}`);
  assert(
    ['ready', 'soft_handoff', 'disabled'].includes(HUB_SEARCH_ADAPTERS[h].maturity),
    `maturity explicit: ${h}`
  );
}

assert(HUB_SEARCH_ADAPTERS.move.maturity === 'ready', 'move ready');
assert(HUB_SEARCH_ADAPTERS.lender.maturity === 'ready', 'lender ready');
assert(HUB_SEARCH_ADAPTERS.insurance.maturity === 'ready', 'insurance ready');
assert(HUB_SEARCH_ADAPTERS.contractor.maturity === 'soft_handoff', 'contractor soft');
assert(HUB_SEARCH_ADAPTERS.senior.maturity === 'ready', 'senior ready');
assert(HUB_SEARCH_ADAPTERS.investor.maturity === 'ready', 'investor ready');

// --- Move required ---
{
  const a = vm('movers in Keansburg NJ');
  assert(a.status === 'ok' && a.handoff.destinationHub === 'move', 'move: keansburg view_more');
  assert(a.status === 'ok' && a.handoff.context.city === 'keansburg', 'move: city');
  assert(a.status === 'ok' && a.handoff.context.entity === 'mover', 'move: entity');
  assert(a.status === 'ok' && a.handoff.analytics.source === 'ask', 'move: analytics source');
  assert(a.status === 'ok' && a.handoff.analytics.handoffType === 'view_more', 'move: analytics type');

  const b = vm('licensed movers around 07734');
  assert(b.status === 'ok' && !b.handoff.context.zip, 'move: ZIP not asserted as service context');
  assert(b.status === 'ok' && b.handoff.context.state === 'NJ', 'move: zip→NJ');
  assert(b.status === 'ok' && b.handoff.context.county === 'monmouth', 'move: ZIP resolves to county context');

  const c = vm('moving broker in Miami');
  assert(c.status === 'ok' && c.handoff.context.entity === 'moving_broker', 'move: broker entity');
}

// --- Lender required ---
{
  const a = vm('mortgage companies in Florida');
  assert(a.status === 'ok' && a.handoff.destinationHub === 'lender', 'lender: FL companies');
  assert(a.status === 'ok' && a.handoff.url.includes('lendertrusthub.com'), 'lender origin');

  const b = vm('FHA lenders Tampa');
  assert(b.status === 'ok' && b.handoff.context.category === 'fha', 'lender: FHA category');
  assert(b.status === 'ok' && b.handoff.context.city === 'tampa', 'lender: tampa');
}

// --- Insurance required ---
{
  const a = vm('Medicare agents Indiana');
  assert(a.status === 'ok' && a.handoff.context.entity === 'medicare_agent', 'insurance: medicare');

  const b = vm('homeowners insurance Miami');
  // parser may say home insurance / homeowners — accept agency + homeowners-ish
  assert(b.status === 'ok' && b.handoff.destinationHub === 'insurance', 'insurance: homeowners miami hub');
}

// --- Contractor required ---
{
  const a = vm('roofers Miami');
  assert(a.status === 'ok' && a.handoff.maturity === 'soft_handoff', 'contractor soft maturity');
  assert(a.status === 'ok' && a.handoff.context.category === 'roofing', 'contractor roofing');

  const b = vm('kitchen remodeler Fort Lauderdale');
  assert(b.status === 'ok' && b.handoff.context.category === 'kitchen_remodel', 'contractor kitchen');
}

// --- Senior required ---
{
  const a = vm('nursing homes Austin TX');
  assert(a.status === 'ok' && a.handoff.context.entity === 'nursing_facility', 'senior nursing');
  assert(a.status === 'ok' && a.handoff.maturity === 'ready', 'senior ready maturity');
  assert(a.status === 'ok' && a.handoff.url.includes('/from-ask'), 'senior view more /from-ask');

  const b = vm('assisted living Austin');
  assert(b.status === 'unsupported', 'assisted living fail closed');
  assert(
    b.status === 'unsupported' && /assisted_living|senior_care_type/i.test(b.reason || ''),
    'assisted living unsupported reason'
  );

  const c = vm('memory care Austin');
  assert(c.status === 'unsupported', 'memory care unsupported');
  assert(
    c.status === 'unsupported' && c.reason.includes('memory_care'),
    'memory care reason'
  );
}

// --- Investor required ---
{
  const a = vm('RIA Boca Raton');
  assert(a.status === 'ok' && a.handoff.context.entity === 'ria', 'investor RIA');
  assert(a.status === 'ok' && a.handoff.maturity === 'ready', 'investor ready maturity');
  assert(a.status === 'ok' && a.handoff.url.includes('/from-ask'), 'investor view more /from-ask');

  const b = vm('investment advisers in Palm Beach County');
  assert(b.status === 'ok' && b.handoff.context.county === 'palm-beach', 'investor county');
}

// --- Ambiguity / fail-closed ---
{
  assert(vm('broker in Tampa').status === 'needs_clarification', 'broker ambiguity');
  assert(vm('company near me').status === 'needs_clarification', 'company near me');
  const ins = vm('insurance company near me');
  assert(
    ins.status === 'needs_clarification' || ins.status === 'ok',
    'insurance company near me conservative'
  );
  // Prefer clarification when parser flags it
  const intent = parseUniversalSearchQuery('insurance company near me');
  if (intent.requiresClarification) {
    assert(ins.status === 'needs_clarification', 'insurance company clarifies when required');
  }

  const lo = vm('loan officer Tampa');
  assert(lo.status === 'ok' && lo.handoff.maturity === 'soft_handoff', 'loan officer soft');

  assert(vm('home inspector Miami').status === 'unsupported', 'home inspector unsupported');
  assert(vm('credit repair companies Florida').status === 'unsupported', 'credit repair unsupported');
}

// --- Entity Option A: canonical URL + context + handoffType ---
{
  const intent = parseUniversalSearchQuery('movers in Keansburg NJ');
  const entity: NetworkDiscoveryEntity = {
    network_entity_id: 'move:sample-mover',
    hub: 'move',
    source_entity_id: 'sample-mover',
    entity_type: 'mover',
    display_name: 'Sample Moving Co',
    canonical_profile_url: 'https://www.movetrusthub.com/movers/sample-mover',
    city: 'Keansburg',
    state: 'NJ',
  };
  const out = resolveEntityDestination(entity, intent);
  assert(out.status === 'ok', 'entity destination ok');
  if (out.status === 'ok') {
    const h = out.handoff;
    assert(h.handoffType === 'entity', 'handoffType=entity');
    assert(h.url.startsWith('https://www.movetrusthub.com/movers/sample-mover'), 'canonical URL base');
    assert(h.url.includes('src=ask'), 'source=ask on entity URL');
    assert(h.url.includes('entity=mover'), 'entity context');
    assert(h.url.includes('state=NJ'), 'state context');
    assert(h.analytics.handoffType === 'entity', 'analytics handoffType');
    assert(h.analytics.source === 'ask', 'analytics source');
    assert(!!h.backLabel?.includes('Keansburg'), 'backLabel for future back UI');
    assert(
      'canonicalProfileUrl' in h &&
        (h as ReturnType<typeof buildEntityHandoff>).canonicalProfileUrl.includes(
          '/movers/sample-mover'
        ),
      'canonicalProfileUrl preserved'
    );
  }

  const memEntity: NetworkDiscoveryEntity = {
    network_entity_id: 'senior:mem-1',
    hub: 'senior',
    source_entity_id: 'mem-1',
    entity_type: 'memory_care',
    display_name: 'Memory Place',
    canonical_profile_url: 'https://www.seniortrusthub.com/facilities/mem-1',
  };
  assert(
    resolveEntityDestination(memEntity, parseUniversalSearchQuery('memory care Austin')).status ===
      'unsupported',
    'entity memory care fail-closed'
  );
}

// --- Round-trip ---
{
  const intent = parseUniversalSearchQuery('movers in Keansburg NJ');
  const handoff = buildViewMoreHandoff(intent)!;
  const ser = serializeHandoffContext(handoff.context);
  const parsed = parseHandoffContext(ser);
  assert(parsed.src === 'ask', 'rt src');
  assert(parsed.state === 'NJ', 'rt state');
  assert(parsed.city === 'keansburg', 'rt city');
  assert(parsed.entity === 'mover', 'rt entity');
  assert(parsed.journey === handoff.context.journey, 'rt journey');
}

// --- PII / security ---
{
  const dirty = parseHandoffContext(
    'src=ask&entity=mover&state=NJ&query=secret&email=a@b.com&phone=555&name=Jane&address=1+Main+St&ssn=123&document=x&account=1&diagnosis=y&holdings=z&lat=1&lng=2'
  );
  assert(dirty.entity === 'mover' && dirty.state === 'NJ', 'allowlist keeps safe');
  for (const bad of [
    'query',
    'email',
    'phone',
    'name',
    'address',
    'ssn',
    'document',
    'account',
    'diagnosis',
    'holdings',
    'lat',
    'lng',
  ]) {
    assert(!(bad in dirty) || (dirty as Record<string, unknown>)[bad] === undefined, `rejects ${bad}`);
  }
  assert(!SEARCH_HANDOFF_KEYS.includes('query' as never), 'query not in allowlist');
  const intent = parseUniversalSearchQuery('movers in Keansburg NJ');
  const ser = serializeHandoffContext(intentToHandoffContext(intent));
  assert(!ser.includes('movers+in') && !ser.includes('Keansburg%20NJ'), 'no free-text query blob');
}

// --- Life-event does not replace Stage B.2 (primary hub destination only) ---
{
  const le = vm("I'm moving from New Jersey to Florida and buying a house");
  assert(le.status === 'ok' && le.handoff.destinationHub === 'move', 'life-event → move destination only');
}

if (failed) {
  console.error(`ASK-SEARCH-004 FAILED (${failed})`);
  process.exit(1);
}
console.log('ASK-SEARCH-004 adapter/handoff assertions passed.');
