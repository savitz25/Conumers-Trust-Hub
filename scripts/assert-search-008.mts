/**
 * ASK-SEARCH-008 — six-hub Senior + Investor activation contract tests (no browser).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUniversalSearchQuery } from '../lib/search/parser';
import {
  SEARCH_HANDOFF_KEYS,
  resolveViewMoreDestination,
  buildEntityHandoff,
  HUB_SEARCH_ADAPTERS,
} from '../lib/search';
import { createRealDiscoveryIndex, loadSpecialistFeed, loadProvenance } from '../lib/search/feeds';
import { runUniversalSearch } from '../lib/search/ui/run-search';
import { ACTIVE_SEARCH_HUBS } from '../lib/search/ui/labels';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('PASS:', msg);
}

const root = process.cwd();
const index = createRealDiscoveryIndex(root);
const bundle = index.bundle;
const provenance = loadProvenance(root);

assert(HUB_SEARCH_ADAPTERS.senior.maturity === 'ready', 'senior adapter ready');
assert(HUB_SEARCH_ADAPTERS.investor.maturity === 'ready', 'investor adapter ready');
assert(HUB_SEARCH_ADAPTERS.move.maturity === 'ready', 'move unchanged ready');
assert(HUB_SEARCH_ADAPTERS.lender.maturity === 'ready', 'lender unchanged ready');
assert(HUB_SEARCH_ADAPTERS.insurance.maturity === 'ready', 'insurance unchanged ready');
assert(HUB_SEARCH_ADAPTERS.contractor.maturity === 'soft_handoff', 'contractor unchanged soft');

assert(
  ACTIVE_SEARCH_HUBS.join() === 'move,lender,insurance,contractor,senior,investor',
  'six active search hubs'
);

for (const hub of ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'] as const) {
  const f = bundle.feeds.find((x) => x.hub === hub);
  assert(f?.status === 'ok', `${hub} feed ok (${f?.issues[0]?.message || ''})`);
}

assert(bundle.counts.move === 200, `move 200 (got ${bundle.counts.move})`);
assert(bundle.counts.lender === 200, `lender 200 (got ${bundle.counts.lender})`);
assert(bundle.counts.insurance === 180, `insurance 180 (got ${bundle.counts.insurance})`);
assert(bundle.contractor_fl_active === 112, `contractor FL 112 (got ${bundle.contractor_fl_active})`);
assert(bundle.counts.senior === 200, `senior 200 (got ${bundle.counts.senior})`);
assert(bundle.counts.investor === 200, `investor 200 (got ${bundle.counts.investor})`);
assert(index.size() === 1092, `active-index total 1092 (got ${index.size()})`);

// Fingerprints preserved (envelope fingerprint in provenance)
for (const hub of ['senior', 'investor'] as const) {
  const feed = loadSpecialistFeed(hub, root);
  assert(feed.status === 'ok', `${hub} load ok`);
  assert(feed.fingerprint === provenance[hub].fingerprint, `${hub} fingerprint match`);
  assert(feed.entity_count === 200, `${hub} entity_count 200`);
  const raw = JSON.parse(readFileSync(join(root, provenance[hub].local_path), 'utf8')) as {
    fingerprint: string;
    entity_count: number;
  };
  assert(raw.fingerprint === provenance[hub].fingerprint, `${hub} file banner fingerprint`);
  assert(raw.entity_count === 200, `${hub} file entity_count`);
}

function run(q: string) {
  const intent = parseUniversalSearchQuery(q);
  const res = index.search(intent);
  const vm = resolveViewMoreDestination(intent);
  const ui = runUniversalSearch(q);
  return { intent, res, vm, ui };
}

function allowlisted(url: string) {
  const u = new URL(url);
  for (const k of u.searchParams.keys()) {
    if (k === 'src') continue;
    if (!(SEARCH_HANDOFF_KEYS as readonly string[]).includes(k)) return false;
  }
  return !u.searchParams.has('q') && !u.searchParams.has('query');
}

function noRawQueryLeak(url: string, raw: string) {
  const u = new URL(url);
  if ([...u.searchParams.keys()].some((k) => k === 'q' || k === 'query')) return false;
  const compact = raw.toLowerCase().replace(/\s+/g, '+');
  return !u.search.toLowerCase().includes(compact.slice(0, 24));
}

// --- Senior nursing / SNF ---
{
  const { intent, res, vm, ui } = run('nursing homes Miami FL');
  assert(intent.hub === 'senior' && intent.entityType === 'nursing_facility', 'Senior Miami parse');
  assert(res.status === 'ok' && res.total >= 1, `Senior Miami eligible ${res.total}`);
  assert(res.topMatches.length <= 7 && res.topMatches.length >= 1, 'Senior Miami top 1-7');
  assert(res.matches.every((m) => m.entity.hub === 'senior'), 'Senior Miami no hub bleed');
  assert(res.matches.every((m) => m.entity.entity_type === 'nursing_facility'), 'Senior Miami nursing only');
  assert(vm.status === 'ok' && vm.handoff.url.includes('seniortrusthub.com/from-ask'), 'Senior VM /from-ask');
  assert(vm.status === 'ok' && vm.handoff.maturity === 'ready', 'Senior VM ready');
  assert(ui.status === 'ok' && ui.topMatches.length <= 7, 'Senior Miami UI ok');
  const ent = buildEntityHandoff(res.topMatches[0].entity, intent);
  assert(ent.url.includes('seniortrusthub.com'), 'Senior profile host');
  assert(/\/facility\//.test(ent.url) || /ccn/i.test(ent.url), 'Senior CMS profile path');
  assert(allowlisted(ent.url) && noRawQueryLeak(ent.url, 'nursing homes Miami FL'), 'Senior entity allowlist');
  assert(noRawQueryLeak(vm.status === 'ok' ? vm.handoff.url : '', 'nursing homes Miami FL'), 'Senior VM no raw q');
  assert(!/five[- ]star|cms rating|star rating/i.test(JSON.stringify(res.topMatches)), 'Senior Five-Star neutral');
}

{
  const { intent, res, vm } = run('nursing homes New Jersey');
  assert(intent.location?.stateCode === 'NJ', 'Senior NJ state');
  assert(res.total >= 1 && res.topMatches.length <= 7, `Senior NJ ${res.total}`);
  assert(vm.status === 'ok' && vm.handoff.context.state === 'NJ', 'Senior NJ VM state');
}

{
  const { res, ui } = run('nursing homes Keansburg NJ');
  assert(res.total === 0 && (res.status === 'empty' || ui.status === 'empty'), 'Senior zero Keansburg');
  assert(ui.status === 'empty', 'Senior zero UI empty (not unsupported)');
  assert(!/not supported|isn’t available yet/i.test(ui.message || ''), 'Senior zero distinct copy');
}

// --- Senior fail-closed ---
for (const q of ['assisted living Miami', 'memory care Florida', 'home care Tampa']) {
  const { intent, res, vm, ui } = run(q);
  assert(intent.supported === false, `${q} parser unsupported`);
  assert(res.status === 'unsupported' && res.total === 0, `${q} search unsupported`);
  assert(vm.status === 'unsupported', `${q} VM unsupported`);
  assert(ui.status === 'unsupported' && ui.topMatches.length === 0, `${q} UI unsupported`);
  assert(/did not substitute nursing/i.test(ui.message || ''), `${q} no nursing substitution copy`);
}

// --- Investor RIA / ERA ---
{
  const { intent, res, vm, ui } = run('RIAs Boca Raton FL');
  assert(intent.hub === 'investor' && intent.entityType === 'ria', 'Investor Boca parse');
  assert(res.status === 'ok' && res.total >= 1, `Investor Boca ${res.total}`);
  assert(res.topMatches.length <= 7, 'Investor Boca cap 7');
  assert(res.matches.every((m) => m.entity.entity_type === 'ria'), 'Investor Boca RIA only');
  assert(!res.matches.some((m) => m.entity.entity_type === 'era'), 'Investor Boca no ERA bleed');
  assert(vm.status === 'ok' && vm.handoff.url.includes('investortrusthub.com/from-ask'), 'Investor VM /from-ask');
  assert(vm.status === 'ok' && vm.handoff.maturity === 'ready', 'Investor VM ready');
  const ent = buildEntityHandoff(res.topMatches[0].entity, intent);
  assert(/sec-crd|\/firm\//i.test(ent.url), 'Investor CRD profile');
  assert(allowlisted(ent.url) && noRawQueryLeak(ent.url, 'RIAs Boca Raton FL'), 'Investor entity allowlist');
  assert(ui.status === 'ok', 'Investor Boca UI');
  assert(!/raum|aum|assets under/i.test(JSON.stringify(res.topMatches)), 'Investor RAUM/AUM neutral');
}

{
  const { res } = run('RIAs Florida');
  assert(res.total >= 1 && res.matches.every((m) => m.entity.entity_type === 'ria'), 'Investor FL RIA only');
  assert(!res.matches.some((m) => m.entity.entity_type === 'era'), 'FL RIA ≠ ERA');
}

{
  const { intent, res } = run('ERA Florida');
  assert(intent.entityType === 'era', 'ERA parse');
  assert(res.total >= 1 && res.matches.every((m) => m.entity.entity_type === 'era'), 'ERA only');
  assert(!res.matches.some((m) => m.entity.entity_type === 'ria'), 'ERA ≠ RIA');
}

{
  const { res, ui, vm } = run('ERA New York');
  assert(res.total === 0 && ui.status === 'empty', 'Investor ERA NY zero');
  assert(vm.status === 'ok' && vm.handoff.url.includes('/from-ask'), 'ERA NY still has VM');
}

{
  const { res, ui } = run('RIAs Keansburg NJ');
  assert(res.total === 0 && ui.status === 'empty', 'Investor zero Keansburg');
}

// --- Investor product fail-closed ---
for (const q of ['mutual funds Florida', 'ETF Miami', 'apple stock']) {
  const { intent, res, vm, ui } = run(q);
  assert(intent.supported === false || intent.hub === 'investor', `${q} investor product parse`);
  assert(res.status === 'unsupported' || res.total === 0, `${q} no product results`);
  assert(ui.topMatches.length === 0, `${q} UI empty/unsupported`);
  if (ui.status === 'unsupported') {
    assert(/did not substitute investment advisers/i.test(ui.message || '') || /not supported/i.test(ui.message || ''), `${q} product copy`);
  }
  assert(vm.status === 'unsupported' || res.status === 'unsupported', `${q} not soft to advisers`);
}

// --- Existing four-hub regression samples ---
{
  const kean = run('movers in Keansburg NJ');
  assert(kean.res.total > 0 && kean.res.topMatches.length <= 7, 'Move Keansburg regression');
  assert(kean.vm.status === 'ok' && kean.vm.handoff.url.includes('movetrusthub.com'), 'Move VM');

  const lend = run('mortgage companies in Florida');
  assert(lend.res.total > 0 && lend.vm.status === 'ok' && lend.vm.handoff.url.includes('/from-ask'), 'Lender regression');

  const ins = run('auto insurance agencies Texas');
  assert(ins.res.total > 0 && ins.vm.status === 'ok', 'Insurance regression');

  const roof = run('roofers Miami FL');
  assert(roof.res.total > 0 && roof.res.matches.every((m) => m.entity.hub === 'contractor'), 'Contractor regression');
}

// --- Top Matches contract ---
{
  const a = runUniversalSearch('nursing homes Miami FL').topMatches;
  const b = runUniversalSearch('nursing homes Miami FL').topMatches;
  assert(a.length === b.length && a.map((c) => c.id).join() === b.map((c) => c.id).join(), 'stable order / no re-search drift');
  assert(a.length <= 7, 'max 7');
  const tot = run('nursing homes Miami FL').res.total;
  assert(a.length <= tot, 'no padding beyond eligible');
}

// --- Privacy: health / financial PII must not cross domains ---
{
  const senior = run('nursing homes Miami FL');
  const inv = run('RIAs Boca Raton FL');
  const sUrl = senior.res.topMatches[0]
    ? buildEntityHandoff(senior.res.topMatches[0].entity, senior.intent).url
    : '';
  const iUrl = inv.res.topMatches[0]
    ? buildEntityHandoff(inv.res.topMatches[0].entity, inv.intent).url
    : '';
  assert(!/investortrusthub|crd-|raum|aum/i.test(sUrl), 'health path stays on Senior');
  assert(!/seniortrusthub|ccn-|cms|nursing|diagnosis|ssn/i.test(iUrl), 'financial path stays on Investor');
  assert(!sUrl.includes('email=') && !iUrl.includes('email='), 'no email PII in handoff');
}

// File bytes not rewritten for specialist snapshots (hash of entities payload via banner)
{
  const seniorRaw = readFileSync(join(root, 'data/network-discovery/feeds/senior.v1.json'));
  const investorRaw = readFileSync(join(root, 'data/network-discovery/feeds/investor.v1.json'));
  assert(seniorRaw.length > 1000, 'senior snapshot present');
  assert(investorRaw.length > 1000, 'investor snapshot present');
  // sanity: provenance SHAs recorded
  assert(provenance.senior.source_sha.length === 40, 'senior source SHA');
  assert(provenance.investor.source_sha.length === 40, 'investor source SHA');
  assert(
    (provenance.senior.receiving_sha || '').length === 40,
    'senior receiving_sha (SENIOR-002)'
  );
  assert(
    (provenance.investor.receiving_sha || '').length === 40,
    'investor receiving_sha (INVESTOR-002)'
  );
}

if (failed) {
  console.error(`ASK-SEARCH-008 FAILED (${failed})`);
  process.exit(1);
}
console.log('ASK-SEARCH-008 six-hub Senior+Investor assertions passed.');
console.log(
  JSON.stringify(
    {
      counts: bundle.counts,
      total: index.size(),
      senior_fp: provenance.senior.fingerprint,
      investor_fp: provenance.investor.fingerprint,
      contractor_fl: bundle.contractor_fl_active,
    },
    null,
    2
  )
);
