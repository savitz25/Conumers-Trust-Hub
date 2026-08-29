import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';


const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  }
}

const standard = read('lib/standard.ts');
assert(standard.includes("verb: 'EXPLAIN'"), 'EXPLAIN step');
assert(!/verb: 'SCORE'/.test(standard), 'no SCORE step');
assert(!/verb: 'RATE'/.test(standard) && !/verb: 'RANK'/.test(standard), 'no RATE/RANK step');

const home = read('app/page.tsx');
assert(home.includes('NetworkAskHero'), 'hero');
assert(home.includes('NetworkLiveMosaic'), 'mosaic');
assert(home.includes('NetworkFindings'), 'findings');
assert(home.includes('NetworkSourcePreview'), 'source preview');
assert(home.indexOf('<NetworkAskHero') < home.indexOf('<HomeConciergeDemoted'), 'intelligence before concierge');
assert(home.indexOf('<NetworkLiveMosaic') < home.indexOf('<HomeLifeJourneys'), 'intelligence before journeys');
assert(home.includes('HomeConciergeDemoted'), 'concierge retained');

const hero = read('components/network-ask-hero.tsx');
assert(hero.includes('Ask the TrustHub Network'), 'H1 copy');
assert(hero.includes('The Trust Hub Network'), 'eyebrow');

const input = read('components/network-ask-input.tsx');
assert(input.includes('Find someone'), 'chip find');
assert(input.includes('Ask the market'), 'chip market');
assert(input.includes('Compare places'), 'chip compare');
assert(input.includes('Help with a decision'), 'chip decision');

const findings = read('lib/network/findings.ts');
assert(['evidence-models', 'identity', 'geography'].every((id) => findings.includes(`id: '${id}'`)), 'exactly three findings');
assert(findings.includes('Explore how evidence differs'), 'finding 1 CTA');
assert(findings.includes('See how TrustHub resolves identity'), 'finding 2 CTA');
assert(findings.includes('Explore geography and coverage'), 'finding 3 CTA');
assert(findings.includes('carrier'), 'carrier vs broker');
assert(findings.includes('HMDA property county'), 'HMDA geography');

const adapters = read('lib/network/adapters.ts');
assert(adapters.includes("id: 'move'"), 'move adapter');
assert(adapters.includes("id: 'lender'"), 'lender adapter');
assert(adapters.includes("id: 'insurance'"), 'insurance adapter');
assert(adapters.includes("id: 'contractor'"), 'contractor adapter');
assert(adapters.includes("id: 'senior'"), 'senior adapter');
assert(adapters.includes("id: 'investor'"), 'investor adapter');
assert(!/24 million|2\.1 million/i.test(adapters), 'no mega-count copy');
assert(!/one ['"]senior providers['"]/i.test(adapters), 'no senior mega class');
assert(adapters.includes('checked_in_canonical_snapshot'), 'ask-owned adapters');
assert(!adapters.includes('querySelector'), 'no HTML scrape');

const methodology = read('app/methodology/page.tsx');
assert(methodology.includes('SOURCE → VERIFY → EXPLAIN → DISCLOSE → UPDATE → YOU DECIDE'), 'methodology pipeline');
assert(!methodology.includes('DISCLOSE → SCORE'), 'methodology SCORE removed');

const coverage = read('lib/network/coverage-atlas.ts');
assert(coverage.includes('coverage-atlas-schema-v1'), 'coverage atlas schema only');
assert(!/researchDepthScore|depth_score/i.test(coverage), 'no coverage depth score');

const evidence = read('lib/network/evidence-atlas.ts');
assert(evidence.includes('evidence-atlas-schema-v1'), 'evidence atlas schema only');
assert(!/percentComplete|coveragePercent/i.test(evidence), 'no evidence percentage');

const federated = read('lib/network/federated-ask.ts');
assert(federated.includes('network-ask-route-v1'), 'federated ask contract');

const nameCheck = read('lib/network/name-check.ts');
assert(nameCheck.includes('name-check-invariant-v1'), 'name-check invariant');
assert(nameCheck.includes('not a confirmed identity match') || nameCheck.includes('NAME_IS_NOT_IDENTITY'), 'name ≠ identity');

const aggregator = read('lib/network/aggregator.ts');
assert(aggregator.includes('sourceFamilyCount'), 'computed family count');
assert(aggregator.includes('sourceOrganizationCount'), 'computed org count');
assert(aggregator.includes('regulatorCount'), 'computed regulator count');
assert(!aggregator.includes('entityTotal'), 'no cross-hub entity sum');

console.log('check-ask-2-prompt-1 source contracts PASS');
