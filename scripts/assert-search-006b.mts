/**
 * ASK-SEARCH-006B — real multi-hub discovery engine tests.
 */
import { parseUniversalSearchQuery } from '../lib/search/parser';
import { SEARCH_HANDOFF_KEYS, resolveViewMoreDestination, buildEntityHandoff } from '../lib/search';
import { createRealDiscoveryIndex, loadSpecialistFeed } from '../lib/search/feeds';
import { rankMatches, scoreEntity } from '../lib/search/discovery/ranking';
import type { NetworkDiscoveryEntity } from '../lib/search/discovery/types';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('PASS:', msg);
}

const root = process.cwd();
const t0 = performance.now();
const index = createRealDiscoveryIndex(root);
const loadMs = performance.now() - t0;
const bundle = index.bundle;

for (const hub of ['move', 'lender', 'insurance', 'contractor'] as const) {
  const f = bundle.feeds.find((x) => x.hub === hub);
  assert(f?.status === 'ok', `${hub} feed ok (${f?.issues[0]?.message || ''})`);
}

assert(bundle.counts.move === 200, `move active 200 (got ${bundle.counts.move})`);
assert(bundle.counts.lender === 200, `lender active 200 (got ${bundle.counts.lender})`);
assert(bundle.counts.insurance === 180, `insurance active 180 (got ${bundle.counts.insurance})`);
assert(bundle.contractor_imported === 200, 'contractor imported 200');
assert(bundle.contractor_fl_active < 200, 'contractor FL active is a subset');
assert(bundle.contractor_fl_active > 0, `contractor FL active ${bundle.contractor_fl_active}`);

// Atomic failure
{
  const move = loadSpecialistFeed('move', root);
  assert(move.status === 'ok', 'move loads');
}

function run(q: string) {
  const tParse = performance.now();
  const intent = parseUniversalSearchQuery(q);
  const parseMs = performance.now() - tParse;
  const tSearch = performance.now();
  const res = index.search(intent);
  const searchMs = performance.now() - tSearch;
  const vm = resolveViewMoreDestination(intent);
  return { intent, res, vm, parseMs, searchMs };
}

function noBleed(res: ReturnType<typeof index.search>, hub: string) {
  return res.matches.every((m) => m.entity.hub === hub);
}

function allowlistedUrl(url: string) {
  const u = new URL(url);
  for (const k of u.searchParams.keys()) {
    if (k === 'src') continue;
    if (!(SEARCH_HANDOFF_KEYS as readonly string[]).includes(k)) return false;
  }
  return !url.includes('query=') && !url.includes('email=');
}

// --- Move ---
{
  const { intent, res, vm } = run('movers in Keansburg NJ');
  assert(intent.hub === 'move' && intent.entityType === 'mover', 'Keansburg parsed move/mover');
  assert(intent.location?.cityName === 'Keansburg', 'Keansburg city');
  assert(intent.location?.countySlug === 'monmouth', 'Keansburg → Monmouth');
  assert(res.status === 'ok' && res.total > 0, `Keansburg eligible ${res.total}`);
  assert(res.topMatches.length <= 7 && res.topMatches.length >= 1, 'Keansburg top 1-7');
  assert(noBleed(res, 'move'), 'Keansburg no hub bleed');
  assert(
    res.topMatches.every((m) => !m.reasons.includes('exact_physical_city') || m.entity.city?.toLowerCase() === 'keansburg'),
    'no fake exact Keansburg city'
  );
  assert(
    res.matches.some((m) => m.reasons.includes('county_service_area') || m.reasons.includes('county_match')),
    'Keansburg county service present'
  );
  assert(vm.status === 'ok' && vm.handoff.url.includes('movetrusthub.com'), 'Keansburg view more Move');
  const ent = buildEntityHandoff(res.topMatches[0].entity, intent);
  assert(allowlistedUrl(ent.url) && ent.url.includes('src=ask'), 'Keansburg entity handoff allowlist');
  console.log('INFO Keansburg eligible', res.total, 'top', res.topMatches.length);
}

{
  const { intent, res } = run('licensed movers around 07734');
  assert(intent.location?.zip === '07734', '07734 zip');
  assert(intent.location?.cityName === 'Keansburg', '07734 → Keansburg');
  assert(intent.location?.countySlug === 'monmouth', '07734 → Monmouth');
  assert(res.total > 0 && res.topMatches.length <= 7, '07734 has matches cap 7');
  assert(
    res.matches.some((m) => m.reasons.includes('county_service_area_via_zip_resolution') || m.reasons.includes('county_service_area')),
    '07734 county-via-zip reason'
  );
  assert(
    !res.matches.some((m) => m.reasons.includes('zip_match') && !m.entity.zip),
    'no fabricated explicit ZIP coverage'
  );
  console.log('INFO 07734 eligible', res.total, 'top', res.topMatches.length);
}

{
  const { res } = run('moving broker in Miami');
  assert(res.total === 0, `Miami brokers zero (got ${res.total})`);
}

{
  const { res } = run('movers in Florida');
  assert(res.total > 0 && res.topMatches.length <= 7, 'FL movers');
  assert(noBleed(res, 'move'), 'FL movers hub');
  const top = res.topMatches[0];
  assert(
    !top ||
      !top.reasons.includes('nationwide_coverage') ||
      top.reasons.includes('state_service_area') ||
      top.reasons.includes('physical_state') ||
      top.reasons.includes('county_service_area'),
    'broad national should not lead Florida results without FL evidence'
  );
  console.log('INFO FL movers eligible', res.total, 'top', res.topMatches.length, 'first', top?.entity.display_name);
}

{
  const { intent, res } = run('interstate movers in New Jersey');
  assert(intent.entityType === 'interstate_mover' || intent.hub === 'move', 'interstate parse');
  assert(res.topMatches.length <= 7, 'NJ interstate cap');
  assert(
    res.matches.every((m) => m.entity.entity_type === 'interstate_mover' || m.entity.entity_type === 'mover'),
    'interstate family'
  );
  console.log('INFO NJ interstate eligible', res.total, 'top', res.topMatches.length);
}

// --- Lender ---
{
  const { res, vm } = run('mortgage companies in Florida');
  assert(res.matches.every((m) => m.entity.entity_type === 'mortgage_company'), 'FL companies not brokers/LOs');
  assert(res.topMatches.length <= 7, 'FL companies cap');
  assert(vm.status === 'ok' && vm.handoff.url.includes('/from-ask'), 'lender view more /from-ask');
  console.log('INFO FL mortgage companies', res.total);
}

{
  const { res } = run('FHA lenders Tampa');
  assert(res.matches.every((m) => (m.entity.categories || []).includes('fha')), 'FHA category');
  assert(res.topMatches.length <= 7, 'FHA tampa cap');
  console.log('INFO FHA Tampa', res.total);
}

{
  const { res } = run('mortgage broker in New Jersey');
  assert(res.matches.every((m) => m.entity.entity_type === 'mortgage_broker'), 'NJ brokers only');
  console.log('INFO NJ brokers', res.total);
}

{
  const { res } = run('loan officer Tampa');
  assert(res.status === 'unsupported' && res.total === 0, 'LO not in results');
}

{
  const { res } = run('refinance company near Austin');
  assert(res.total === 0, 'refinance fail closed in real index');
}

// --- Insurance ---
{
  const { res, vm } = run('auto insurance agencies Texas');
  assert(noBleed(res, 'insurance'), 'TX auto insurance hub');
  assert(
    res.matches.every((m) => m.entity.entity_type !== 'insurance_carrier'),
    'agencies not carriers'
  );
  assert(vm.status === 'ok' && vm.handoff.url.includes('insurancetrusthub.com/from-ask'), 'insurance /from-ask');
  console.log('INFO TX auto agencies', res.total);
}

{
  const { res } = run('insurance agencies Dallas TX');
  assert(res.topMatches.length <= 7, 'Dallas cap');
  if (res.total > 1) {
    const first = res.topMatches[0];
    const last = res.matches[res.matches.length - 1];
    if (first.reasons.includes('exact_physical_city') && last.reasons.includes('licensed_service_state')) {
      assert(first.score >= last.score, 'Dallas physical outranks licensed-state-only');
    }
  }
  console.log('INFO Dallas agencies', res.total);
}

{
  const { res } = run('homeowners insurance agencies Miami FL');
  assert(!res.matches.some((m) => /autonation/i.test(m.entity.display_name)), 'AutoNation absent Miami homeowners');
  console.log('INFO Miami homeowners', res.total);
}

{
  const { res } = run('Medicare agents Indiana');
  assert(res.status === 'unsupported' && res.total === 0, 'Medicare unsupported on real index');
}

{
  const { intent, res } = run('insurance company near me');
  assert(intent.requiresClarification, 'insurance company near me ambiguous parse');
  assert(res.status === 'needs_clarification' && res.total === 0, 'insurance company near me no default');
}

assert(
  !index.getAll().some((e) => /autonation/i.test(e.display_name)),
  'AutoNation absent from active index'
);

// --- Contractor ---
{
  const { intent, res, vm } = run('roofers Miami FL');
  assert(intent.category === 'roofing' && intent.location?.countySlug === 'miami-dade', 'Miami roofing geo');
  assert(res.matches.every((m) => m.entity.hub === 'contractor' && m.entity.state === 'FL'), 'FL roofers only');
  assert(res.matches.every((m) => (m.entity.categories || []).includes('roofing')), 'roofing cat');
  assert(res.topMatches.length <= 7, 'Miami roofers cap');
  assert(vm.status === 'ok' && vm.handoff.url.includes('contractortrusthub.com/from-ask'), 'contractor /from-ask');
  console.log('INFO Miami roofers', res.total);
}

{
  const { res } = run('HVAC contractors Tampa FL');
  assert(res.matches.every((m) => (m.entity.categories || []).includes('hvac')), 'Tampa HVAC cat');
  assert(!res.matches.some((m) => (m.entity.categories || []).includes('mechanical')), 'no CMC');
  console.log('INFO Tampa HVAC', res.total);
}

{
  const { res } = run('general contractors Orlando FL');
  assert(res.matches.every((m) => (m.entity.categories || []).includes('general_contractor')), 'Orlando CGC cat');
  console.log('INFO Orlando GC', res.total);
}

{
  const { res } = run('electricians Jacksonville FL');
  assert(res.total === 0, 'Jacksonville electrical zero');
}

{
  const { res } = run('home inspectors Miami FL');
  assert(res.total === 0, 'home inspectors zero');
}

{
  const { res } = run('roofers Monmouth County NJ');
  assert(res.total === 0, 'NJ roofing not READY');
}

// Cap / pad / deterministic
{
  const a = run('movers in Keansburg NJ').res.topMatches.map((m) => m.entity.network_entity_id);
  const b = run('movers in Keansburg NJ').res.topMatches.map((m) => m.entity.network_entity_id);
  assert(a.join() === b.join(), 'deterministic top matches');
  assert(a.length <= 7, 'max 7');
}

{
  const src = index.getAll().filter((e) => e.hub === 'move').slice(0, 3);
  const intent = parseUniversalSearchQuery('movers in Florida');
  const scored = src.map((e) => scoreEntity(e, intent)).filter(Boolean);
  const ranked = rankMatches(scored as NonNullable<(typeof scored)[number]>[]);
  const extra = { premium: true, paid_rank: 1, popularity: 99, overall_rating: 5, review_count: 9000, raum: 1e9 };
  const mutated = src.map((e) => scoreEntity({ ...e, ...extra } as NetworkDiscoveryEntity, intent)).filter(Boolean);
  const ranked2 = rankMatches(mutated as NonNullable<(typeof mutated)[number]>[]);
  assert(
    ranked.map((m) => m.entity.network_entity_id).join() ===
      ranked2.map((m) => m.entity.network_entity_id).join(),
    'premium/payment/ratings/reviews/popularity/RAUM do not change order'
  );
}

{
  const { res } = run('movers in Keansburg NJ');
  assert(res.matches.every((m) => m.entity.hub !== 'lender'), 'move query no lenders');
}
{
  const { res } = run('auto insurance agencies Texas');
  assert(res.matches.every((m) => m.entity.hub !== 'contractor'), 'insurance query no contractors');
}
{
  const { res } = run('roofers Miami FL');
  assert(res.matches.every((m) => m.entity.hub !== 'move'), 'contractor query no movers');
}

console.log(
  JSON.stringify(
    {
      load_ms: Number(loadMs.toFixed(1)),
      size: index.size(),
      counts: bundle.counts,
      contractor_imported: bundle.contractor_imported,
      contractor_fl_active: bundle.contractor_fl_active,
    },
    null,
    2
  )
);

if (failed) {
  console.error(`ASK-SEARCH-006B FAILED (${failed})`);
  process.exit(1);
}
console.log('ASK-SEARCH-006B real multi-hub assertions passed.');
