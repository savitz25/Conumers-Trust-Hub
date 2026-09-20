// TH-SEARCH-R1-019G baseline capture: the CURRENT (pre-change) seniorNameAdapter against live
// Senior production, before it is replaced to consume senior-name-candidates-v1.
import { seniorNameAdapter } from '../lib/network/name-candidates/adapters.ts';

const ctx = { fetcher: fetch, signal: new AbortController().signal };
const names = [
  'Abbey Delray South',
  'Abigail House for Nursing & Rehabilitation',
  'A Holly Patterson Extended Care Facility',
  'FFIII Houston SNF Tenant',
  'ADAMS COUNTY MANOR',
  'senior care Florida',
];

const results = {};
for (const name of names) {
  const r = await seniorNameAdapter.search(name, 1, ctx);
  results[name] = { state: r.state, nameFilterApplied: r.nameFilterApplied, candidateCount: r.candidates.length, message: r.message, firstCandidate: r.candidates[0] ?? null };
  console.log(name, '->', JSON.stringify(results[name], null, 1));
}

const fs = await import('node:fs');
fs.mkdirSync('docs/qa/th-search-r1-019g', { recursive: true });
fs.writeFileSync('docs/qa/th-search-r1-019g/baseline-old-adapter.json', JSON.stringify({ capturedAt: new Date().toISOString(), endpoint: 'https://www.seniortrusthub.com/api/ask (senior-ask-v1, old free-text adapter)', results }, null, 1));
