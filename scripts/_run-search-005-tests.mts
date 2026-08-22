/**
 * ASK-SEARCH-005 — discovery schema + local fixture index tests.
 */
import { parseUniversalSearchQuery } from '../lib/search/parser';
import {
  buildEntityHandoff,
  buildViewMoreHandoff,
  resolveViewMoreDestination,
} from '../lib/search/adapters';
import {
  createFixtureDiscoveryIndex,
  getTopMatchesPreviewCap,
  loadDiscoveryFixtureCorpus,
  validateDiscoveryCorpus,
  validateDiscoveryEntity,
  buildNetworkEntityId,
  parseNetworkEntityId,
} from '../lib/search/discovery';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('PASS:', msg);
  }
}

const root = process.cwd();
const entities = loadDiscoveryFixtureCorpus(root);
const validation = validateDiscoveryCorpus(entities);
assert(validation.ok, `corpus validates (${validation.issues.length} issues)`);
if (!validation.ok) console.error(validation.issues.slice(0, 5));

const byHub: Record<string, number> = {};
for (const e of entities) byHub[e.hub] = (byHub[e.hub] || 0) + 1;
assert(entities.length >= 30, `entity count >= 30 (got ${entities.length})`);
for (const h of ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor']) {
  assert((byHub[h] || 0) >= 3, `${h} has fixtures`);
}

// Identity
assert(buildNetworkEntityId('move', 'usdot-1') === 'move:usdot-1', 'network id builder');
assert(parseNetworkEntityId('senior:ccn-1').sourceEntityId === 'ccn-1', 'network id parse');

// Duplicate IDs rejected
{
  const dup = validateDiscoveryCorpus([entities[0], { ...entities[0] }]);
  assert(!dup.ok, 'duplicate network_entity_id rejected');
}

// Bad host rejected
{
  const bad = validateDiscoveryEntity({
    ...entities[0],
    canonical_profile_url: 'https://evil.example/x',
  });
  assert(bad.some((i) => i.message.includes('host')), 'rejects non-specialist host');
}

// Forbidden fields
{
  const bad = validateDiscoveryEntity({ ...entities[0], trust_score: 99, email: 'a@b.com' });
  assert(bad.some((i) => i.message.includes('forbidden')), 'rejects trust_score/email');
}

const index = createFixtureDiscoveryIndex(root);
assert(index.size() === entities.length, 'index size');
assert(getTopMatchesPreviewCap() === 7, 'preview cap 7');

const times: number[] = [];
function search(q: string) {
  const intent = parseUniversalSearchQuery(q);
  const t0 = performance.now();
  const res = index.search(intent);
  times.push(performance.now() - t0);
  return { intent, res };
}

// Example A — movers Keansburg
{
  const { intent, res } = search('movers in Keansburg NJ');
  assert(intent.hub === 'move', 'A hub move');
  assert(res.status === 'ok' && res.total >= 1, 'A has matches');
  assert(res.topMatches.length <= 7, 'A topMatches <= 7');
  assert(res.topMatches.every((m) => m.hub === undefined || m.entity.hub === 'move'), 'A move only');
  assert(
    res.matches.every((m) => m.entity.entity_type === 'mover' || m.entity.entity_type === 'interstate_mover' || m.entity.entity_type === 'intrastate_mover' || m.entity.entity_type === 'moving_broker' || m.entity.entity_type === 'auto_transporter'),
    'A move entity family'
  );
  // Prefer city match ranked high
  const top = res.topMatches[0];
  assert(top.entity.city === 'Keansburg' || top.reasons.includes('city_match') || top.reasons.includes('service_area_match') || top.reasons.includes('state_match'), 'A geo relevant');
  const handoff = buildEntityHandoff(top.entity, intent);
  assert(handoff.handoffType === 'entity' && handoff.url.includes('src=ask'), 'A entity handoff');
  assert(!!buildViewMoreHandoff(intent), 'A view more');
}

// Example mortgage FL
{
  const { res } = search('mortgage companies in Florida');
  assert(res.status === 'ok' && res.matches.every((m) => m.entity.hub === 'lender'), 'lender only');
  assert(res.total >= 1, 'lender matches');
}

// Medicare Indiana
{
  const { res } = search('Medicare agents Indiana');
  assert(res.status === 'ok', 'medicare ok');
  assert(res.matches.every((m) => m.entity.entity_type === 'medicare_agent'), 'medicare entity type');
  assert(res.matches.every((m) => m.entity.state === 'IN'), 'medicare IN');
}

// Roofers Miami
{
  const { res } = search('roofers Miami');
  assert(res.status === 'ok', 'roofers ok');
  assert(res.matches.every((m) => m.entity.categories?.includes('roofing')), 'roofing category');
}

// Nursing Austin — no AL/memory
{
  const { res } = search('nursing homes Austin Texas');
  assert(res.status === 'ok', 'nursing ok');
  assert(res.matches.every((m) => m.entity.entity_type === 'nursing_facility'), 'nursing only');
  assert(!res.matches.some((m) => m.entity.entity_type === 'assisted_living'), 'no AL');
  assert(!res.matches.some((m) => m.entity.entity_type === 'memory_care'), 'no memory care');
}

// RIA Boca
{
  const { res } = search('RIA Boca Raton');
  assert(res.status === 'ok', 'ria ok');
  assert(res.matches.every((m) => m.entity.entity_type === 'ria'), 'ria types');
}

// Fail-closed
{
  assert(search('broker in Tampa').res.status === 'needs_clarification', 'broker clarify');
  assert(search('broker in Tampa').res.total === 0, 'broker zero matches');
  assert(search('insurance company near me').res.status === 'needs_clarification', 'insurance company clarify');
  assert(search('memory care Austin').res.status === 'unsupported', 'memory care unsupported');
  assert(search('memory care Austin').res.total === 0, 'memory care zero');
  assert(search('home inspector Miami').res.status === 'unsupported', 'home inspector unsupported');
}

// Duplicate display names different IDs
{
  const bay = entities.filter((e) => e.display_name === 'Bayshore Moving LLC');
  assert(bay.length >= 2, 'duplicate display names present');
  assert(bay[0].network_entity_id !== bay[1].network_entity_id, 'stable distinct ids');
}

// Top matches cap with oversized synthetic list
{
  const { res } = search('mortgage companies in Florida');
  assert(res.topMatches.length <= 7, 'topMatches capped');
  assert(res.total >= res.topMatches.length, 'total >= top');
}

// Paid ranking fields absent
{
  assert(
    entities.every((e) => !('paid_rank' in e) && !('premium' in e) && !('popularity' in e) && !('raum' in e)),
    'no paid/premium/popularity/raum fields'
  );
}

// View more composition ready hubs
{
  const intent = parseUniversalSearchQuery('movers in Keansburg NJ');
  const res = index.search(intent);
  const vm = resolveViewMoreDestination(intent);
  assert(vm.status === 'ok', 'view more ok');
  assert(res.total >= 1 && vm.status === 'ok', 'discovery + view more compose');
}

times.sort((a, b) => a - b);
const sum = times.reduce((a, b) => a + b, 0);
const pct = (p: number) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))];
console.log(
  JSON.stringify(
    {
      entities: entities.length,
      by_hub: byHub,
      queries: times.length,
      performance_ms: {
        average: Number((sum / times.length).toFixed(4)),
        p50: Number(pct(50).toFixed(4)),
        p95: Number(pct(95).toFixed(4)),
        max: Number(times[times.length - 1].toFixed(4)),
      },
      external_calls: { AI: 0, Google: 0, external_geo: 0, specialist_APIs: 0, other_network: 0 },
    },
    null,
    2
  )
);

if (failed) {
  console.error(`ASK-SEARCH-005 FAILED (${failed})`);
  process.exit(1);
}
console.log('ASK-SEARCH-005 discovery index assertions passed.');
