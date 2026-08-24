import { runUniversalSearch } from '../lib/search/ui/run-search';

const cases = [
  ['movers in Keansburg NJ', 'move'],
  ['mortgage companies in Florida', 'lender'],
  ['auto insurance agencies Texas', 'insurance'],
  ['roofers Miami FL', 'contractor'],
  ['skilled nursing facilities Miami FL', 'senior'],
  ['RIA Boca Raton', 'investor'],
] as const;

const failures: string[] = [];
for (const [query, expectedHub] of cases) {
  const result = runUniversalSearch(query);
  if (result.status === 'error') failures.push(`${query}: search unavailable`);
  if (result.status !== 'ok') failures.push(`${query}: expected ok, got ${result.status}`);
  if (result.hub !== expectedHub) failures.push(`${query}: expected ${expectedHub}, got ${result.hub}`);
  if (result.topMatches.length < 1 || result.topMatches.length > 7) {
    failures.push(`${query}: invalid Top Matches count ${result.topMatches.length}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`ASK-SEARCH-010 availability assertion PASS (${cases.length}/${cases.length} supported searches).`);
