/**
 * ASK-SEARCH-007 — Universal Search UI contract tests (no browser).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runUniversalSearch } from '../lib/search/ui/run-search';
import { humanMatchReason, assertReasonDoesNotUpgrade } from '../lib/search/ui/match-copy';
import { SEARCH_HANDOFF_KEYS } from '../lib/search/handoff';
import type { DiscoverySearchMatch } from '../lib/search/discovery/types';
import { parseUniversalSearchQuery } from '../lib/search/parser';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else console.log('PASS:', msg);
}

function specialistQueryLeak(url: string, raw: string): boolean {
  const u = new URL(url);
  if ([...u.searchParams.keys()].some((k) => k === 'q' || k === 'query')) return true;
  const compact = raw.toLowerCase().replace(/\s+/g, '+');
  return u.search.toLowerCase().includes(compact.slice(0, 24));
}

function allowlisted(url: string): boolean {
  const u = new URL(url);
  for (const k of u.searchParams.keys()) {
    if (k === 'src') continue;
    if (!(SEARCH_HANDOFF_KEYS as readonly string[]).includes(k)) return false;
  }
  return true;
}

const idle = runUniversalSearch('');
assert(idle.status === 'idle' && idle.topMatches.length === 0, 'empty query idle');

const kean = runUniversalSearch('movers in Keansburg NJ');
assert(kean.status === 'ok', 'Keansburg results');
assert(kean.topMatches.length <= 7 && kean.topMatches.length >= 1, 'Keansburg 1-7');
assert(kean.topMatches.length <= kean.total, 'no padding');
assert(kean.hub === 'move', 'Keansburg hub move');
assert(
  kean.topMatches.every((c) => !/located in keansburg/i.test(c.reasonLine || '') || /keansburg/i.test(c.placeLine || '')),
  'Keansburg copy does not fake exact city from county'
);
assert(
  kean.topMatches.some((c) => /covers monmouth county/i.test(c.reasonLine || '')),
  'Keansburg shows county coverage copy'
);
assert(kean.viewMore?.href.includes('movetrusthub.com'), 'Keansburg view more Move');
assert(allowlisted(kean.topMatches[0].profileUrl), 'profile allowlist');
assert(!specialistQueryLeak(kean.topMatches[0].profileUrl, 'movers in Keansburg NJ'), 'no raw query on profile');
assert(!specialistQueryLeak(kean.viewMore!.href, 'movers in Keansburg NJ'), 'no raw query on view more');
assert(kean.topMatches[0].researchCta.includes('MoveTrustHub'), 'Move hub identity');

const zip = runUniversalSearch('licensed movers around 07734');
assert(zip.status === 'ok' && zip.topMatches.length <= 7, '07734 results');
assert(
  zip.topMatches.every((c) => !/serves zip 07734/i.test(c.reasonLine || '')),
  '07734 does not claim explicit ZIP service'
);

const brokers = runUniversalSearch('moving broker in Miami');
assert(brokers.status === 'empty' || brokers.topMatches.length === 0, 'Miami brokers zero');

const flCo = runUniversalSearch('mortgage companies in Florida');
assert(flCo.status === 'ok' && flCo.hub === 'lender', 'FL mortgage companies');
assert(flCo.viewMore?.href.includes('lendertrusthub.com/from-ask'), 'lender from-ask');

const fha = runUniversalSearch('FHA lenders Tampa');
assert(fha.status === 'ok' || fha.status === 'empty', 'FHA tampa runs');
assert((fha.topMatches.length || 0) <= 7, 'FHA cap');

const njBr = runUniversalSearch('mortgage broker in New Jersey');
assert(njBr.topMatches.length === 0, 'NJ brokers 0 in pilot');

const lo = runUniversalSearch('loan officer Tampa');
assert(lo.status === 'unsupported' && lo.topMatches.length === 0, 'LO unsupported');

const refi = runUniversalSearch('refinance');
assert(refi.topMatches.length === 0, 'refinance zero/unsupported');

const tx = runUniversalSearch('auto insurance agencies Texas');
assert(tx.status === 'ok' && tx.hub === 'insurance', 'TX auto agencies');
assert(tx.viewMore?.href.includes('insurancetrusthub.com/from-ask'), 'insurance from-ask');
assert(tx.topMatches.every((c) => !/autonation/i.test(c.displayName)), 'AutoNation absent');

const dallas = runUniversalSearch('insurance agencies Dallas TX');
assert(
  dallas.topMatches.every((c) => {
    if (/licensed to operate in texas/i.test(c.reasonLine || '')) {
      return !/located in dallas/i.test(c.reasonLine || '');
    }
    return true;
  }),
  'Dallas license-state is not exact city'
);

const miaHome = runUniversalSearch('homeowners insurance agencies Miami FL');
assert(miaHome.topMatches.length === 0, 'Miami homeowners zero');

const med = runUniversalSearch('Medicare agents Indiana');
assert(med.status === 'unsupported', 'Medicare unsupported UI');

const amb = runUniversalSearch('insurance company near me');
assert(amb.status === 'needs_clarification', 'insurance company clarification');
assert((amb.clarification?.choices.length || 0) >= 2, 'clarification choices');

const roof = runUniversalSearch('roofers Miami FL');
assert(roof.status === 'ok' && roof.hub === 'contractor', 'Miami roofers');
assert(roof.viewMore?.href.includes('contractortrusthub.com/from-ask'), 'contractor from-ask');
assert(roof.topMatches.every((c) => /roofing/i.test(c.entityLabel)), 'roofing labels');

const hvac = runUniversalSearch('HVAC contractors Tampa FL');
assert(hvac.status === 'ok', 'Tampa HVAC');

const gc = runUniversalSearch('general contractors Orlando FL');
assert(gc.status === 'ok', 'Orlando GC');

assert(runUniversalSearch('electricians Jacksonville FL').topMatches.length === 0, 'electrical 0');
assert(runUniversalSearch('home inspectors Miami FL').topMatches.length === 0, 'inspectors 0');
assert(runUniversalSearch('roofers Monmouth County NJ').topMatches.length === 0, 'NJ roofing 0');

const xss = runUniversalSearch('<script>alert(1)</script> movers in Keansburg NJ');
assert(
  xss.topMatches.every((c) => !c.profileUrl.includes('<script') && !c.profileUrl.includes('javascript:')),
  'script not in specialist URLs'
);
assert(runUniversalSearch('a'.repeat(5000)).q.length <= 300, 'oversized query capped');
assert(typeof runUniversalSearch('javascript:alert(1)').status === 'string', 'javascript: does not crash');

const a = runUniversalSearch('movers in Keansburg NJ').topMatches.map((c) => c.id);
const b = runUniversalSearch('movers in Keansburg NJ').topMatches.map((c) => c.id);
assert(a.join() === b.join(), 'UI order matches engine (stable)');

const fake: DiscoverySearchMatch = {
  entity: {
    network_entity_id: 'move:x',
    hub: 'move',
    source_entity_id: 'x',
    entity_type: 'mover',
    display_name: 'X',
    canonical_profile_url: 'https://www.movetrusthub.com/companies/x',
    county: 'Monmouth',
    state: 'NJ',
  },
  score: 1,
  reasons: ['county_service_area'],
};
const copy = humanMatchReason(fake, parseUniversalSearchQuery('movers in Keansburg NJ')) || '';
assert(/covers/i.test(copy), 'county service consumer copy');
assert(assertReasonDoesNotUpgrade('county_service_area', copy), 'county copy does not upgrade');
assert(assertReasonDoesNotUpgrade('hmda_activity_county', 'Mortgage activity reported in Hillsborough County'), 'HMDA copy ok');
assert(!assertReasonDoesNotUpgrade('hmda_activity_county', 'Licensed in Hillsborough County'), 'HMDA must not say licensed');

const page = readFileSync(join(process.cwd(), 'app/search/page.tsx'), 'utf8');
assert(page.includes('index: false'), 'search route noindex');
const robots = readFileSync(join(process.cwd(), 'app/robots.ts'), 'utf8');
assert(robots.includes('/search'), 'robots disallows /search');
const sm = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8');
assert(!sm.includes("'/search'"), 'sitemap omits /search');
const hero = readFileSync(join(process.cwd(), 'components/ask-hero.tsx'), 'utf8');
assert(hero.includes('UniversalSearchForm'), 'homepage search entry');
assert(hero.includes('ConciergeEntry'), 'concierge preserved');

if (failed) {
  console.error(`ASK-SEARCH-007 FAILED (${failed})`);
  process.exit(1);
}
console.log('ASK-SEARCH-007 Universal Search UI assertions passed.');
