import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEntityHandoff, resolveViewMoreDestination } from '../lib/search';
import { createRealDiscoveryIndex } from '../lib/search/feeds';
import { parseUniversalSearchQuery } from '../lib/search/parser';
import { runUniversalSearch } from '../lib/search/ui/run-search';

const queries = [
  ['move', 'movers in Keansburg NJ'],
  ['move', 'licensed movers around 07734'],
  ['move', 'movers Miami FL'],
  ['move', 'moving companies Florida'],
  ['move', 'moving broker in Miami'],
  ['lender', 'mortgage companies in Florida'],
  ['lender', 'FHA lenders Tampa'],
  ['lender', 'mortgage brokers New Jersey'],
  ['lender', 'VA lenders Texas'],
  ['lender', 'loan officer Tampa'],
  ['lender', 'refinance'],
  ['insurance', 'auto insurance agencies Texas'],
  ['insurance', 'insurance agencies Dallas TX'],
  ['insurance', 'homeowners insurance agencies Miami FL'],
  ['insurance', 'Medicare agents Indiana'],
  ['insurance', 'insurance company near me'],
  ['contractor', 'roofers Miami FL'],
  ['contractor', 'HVAC contractors Tampa FL'],
  ['contractor', 'general contractors Orlando FL'],
  ['contractor', 'electricians Jacksonville FL'],
  ['contractor', 'home inspectors Miami FL'],
  ['senior', 'skilled nursing facilities Miami FL'],
  ['senior', 'nursing facilities New Jersey'],
  ['senior', 'nursing homes Austin TX'],
  ['senior', 'memory care Austin TX'],
  ['senior', 'assisted living Austin TX'],
  ['investor', 'RIA Boca Raton'],
  ['investor', 'registered investment advisers Florida'],
  ['investor', 'investment advisory firms Miami FL'],
  ['investor', 'ERA New York'],
  ['investor', 'Apple stock'],
] as const;

const index = createRealDiscoveryIndex(process.cwd());
const failures: string[] = [];
const rows = queries.map(([expectedHub, query]) => {
  const intent = parseUniversalSearchQuery(query);
  const result = index.search(intent);
  const ui = runUniversalSearch(query);
  const viewMore = resolveViewMoreDestination(intent);
  const direct = result.topMatches[0] ? buildEntityHandoff(result.topMatches[0].entity, intent).url : null;
  const viewMoreUrl = viewMore.status === 'ok' ? viewMore.handoff.url : null;
  if (ui.status !== 'needs_clarification' && intent.hub !== expectedHub && intent.primaryHub !== expectedHub) failures.push(`${query}: expected ${expectedHub}, got ${intent.hub || intent.primaryHub}`);
  if (result.topMatches.length > 7) failures.push(`${query}: displayed more than 7`);
  for (const url of [direct, viewMoreUrl].filter(Boolean) as string[]) {
    const parsed = new URL(url);
    if (parsed.searchParams.has('q') || parsed.searchParams.has('query')) failures.push(`${query}: raw query leaked`);
  }
  const location = intent.location as typeof intent.location & { city?: string; county?: string; zip?: string };
  return {
    query,
    parsed_hub: intent.hub || intent.primaryHub || null,
    entity: intent.entityType || null,
    category: intent.category || null,
    geography: location ? { state: location.stateCode || null, county: location.county || null, city: location.city || null, zip: location.zip || null } : null,
    state: ui.status,
    eligible_count: result.total,
    displayed_count: result.topMatches.length,
    match_reasons: result.topMatches.map((match) => match.reasons),
    direct_profile: direct,
    view_more: viewMoreUrl,
    assessment: ui.status === 'ok' ? 'supported; bounded and destination-complete' : ui.status,
  };
});

const expectedStates = new Map<string, string>([
  ['moving broker in Miami', 'empty'],
  ['homeowners insurance agencies Miami FL', 'empty'],
  ['nursing homes Austin TX', 'empty'],
  ['ERA New York', 'empty'],
  ['loan officer Tampa', 'unsupported'],
  ['refinance', 'unsupported'],
  ['Medicare agents Indiana', 'unsupported'],
  ['home inspectors Miami FL', 'unsupported'],
  ['memory care Austin TX', 'unsupported'],
  ['assisted living Austin TX', 'unsupported'],
  ['Apple stock', 'unsupported'],
  ['insurance company near me', 'needs_clarification'],
]);
for (const row of rows) {
  const expected = expectedStates.get(row.query);
  if (expected && row.state !== expected) failures.push(`${row.query}: expected ${expected}, got ${row.state}`);
}

mkdirSync(join(process.cwd(), 'artifacts', 'ask-search-009'), { recursive: true });
writeFileSync(join(process.cwd(), 'artifacts', 'ask-search-009', 'search-quality-matrix.json'), `${JSON.stringify({ task: 'ASK-SEARCH-009.1', rows, failures }, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`ASK-SEARCH-009 quality matrix PASS (${rows.length} queries; ${index.size()} entities).`);
