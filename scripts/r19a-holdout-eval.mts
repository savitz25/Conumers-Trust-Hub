// TH-SEARCH-R1-019A: evaluate the FROZEN holdout through the real decision + orchestrator + live hub
// operations. Diagnostic only: a small sample, no statistical claims. Every miss is listed.
import { readFileSync, writeFileSync } from 'node:fs';
import { decideNameCandidateSearch, distinctiveTokens, nameTokens } from '../lib/network/name-candidates/decision.ts';
import { searchNameCandidates } from '../lib/network/name-candidates/orchestrator.ts';
import { planAskResearch } from '../lib/network/research-planner.ts';
import type { SpecialistHubId } from '../lib/network/registry.ts';

const frozen = JSON.parse(readFileSync('docs/qa/th-search-r1-019a/holdout-frozen.json', 'utf8'));
const SUFFIX = /[\s,]+(?:l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|corporation|l\.?p\.?|l\.?l\.?p\.?|ltd\.?|co\.?)[\s,.]*$/i;
const presentation = (name: string) => { let v = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/["“”]/g, '').trim(); for (let i = 0; i < 2; i++) v = v.replace(SUFFIX, '').trim(); return v.replace(/[,.\s]+$/g, '').trim(); };
type EvalRow = { key: string; name: string; variant: string; input: string; skipped?: string; redundantClarification?: boolean; reason?: string; state?: string; failureKind?: string | null; returned?: number; found?: boolean; foundByName?: boolean; rank?: number | null; truncated?: boolean; irrelevant?: number; irrelevantDetail?: unknown[]; ms?: number };
const squash = (v: string) => nameTokens(v).join('');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTarget(hub: string, key: string, c: { stableKey: string; identifiers: Array<{ label: string; value: string }> }): boolean {
  const [kind, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (hub === 'move') return c.stableKey === `move:profile:${value}`;
  if (hub === 'senior') return c.stableKey.endsWith(`:${value}`);
  if (hub === 'lender') return c.identifiers.some((id) => id.value === value);
  return c.stableKey === `${hub}:${kind}:${value}`;
}

async function evalHub(hub: SpecialistHubId, drawn: Array<{ key: string; name: string }>) {
  const rows: EvalRow[] = [];
  for (const record of drawn) {
    const variants = [['displayed', record.name], ['lowercase', record.name.toLowerCase()], ['presentation', presentation(record.name)]] as const;
    for (const [variant, input] of variants) {
      if (variant === 'presentation' && input === record.name) { rows.push({ key: record.key, name: record.name, variant, input, skipped: 'identical_to_displayed' }); continue; }
      const decision = decideNameCandidateSearch(input);
      if (decision.operation !== 'NAME_CANDIDATES') { rows.push({ key: record.key, name: record.name, variant, input, redundantClarification: true, reason: decision.reason, found: false }); continue; }
      const r = await searchNameCandidates({ originalInput: decision.originalInput, name: decision.name, hubScope: hub, priorityHubs: [] });
      const h = r.hubs.find((x) => x.hub === hub)!;
      const rank = h.candidates.findIndex((c) => isTarget(hub, record.key, c));
      const distinct = distinctiveTokens(decision.name, planAskResearch(decision.name));
      const irrelevantRows = h.candidates.filter((c) => { const m = nameTokens(c.matchedName ?? c.displayName); const basis = distinct.length ? distinct : nameTokens(decision.name); return !basis.some((d) => m.some((t) => t === d || t.startsWith(d) || d.startsWith(t))); });
      const irrelevant = irrelevantRows.length;
      rows.push({ key: record.key, name: record.name, variant, input, redundantClarification: false, state: h.state, failureKind: h.failureKind ?? null, returned: h.candidates.length, found: rank >= 0, foundByName: h.candidates.some((c) => squash(c.displayName) === squash(record.name) || squash(c.matchedName) === squash(record.name)), rank: rank >= 0 ? rank + 1 : null, truncated: h.hasMore || h.truncatedWithoutCursor, irrelevant, irrelevantDetail: irrelevantRows.map((c) => ({ displayName: c.displayName, stableKey: c.stableKey, matchMethod: c.matchMethod, matchedField: c.matchedField, matchedName: c.matchedName, hubMatchExplanation: c.hubMatchExplanation })), ms: h.latencyMs });
      await sleep(120);
    }
  }
  return rows;
}

const results: Record<string, EvalRow[]> = {}; const summary: Record<string, unknown> = {};
await Promise.all((Object.keys(frozen.hubs) as SpecialistHubId[]).map(async (hub) => {
  const rows = await evalHub(hub, frozen.hubs[hub].drawn); results[hub] = rows;
  const evaluated = rows.filter((r) => !r.skipped);
  const nameLevel = (v: string) => { const set = evaluated.filter((r) => r.variant === v); return { n: set.length, found: set.filter((r) => r.found || r.foundByName).length }; };
  const byVariant = (v: string) => { const set = evaluated.filter((r) => r.variant === v); return { n: set.length, found: set.filter((r) => r.found).length }; };
  const searched = evaluated.filter((r) => !r.redundantClarification);
  const returned = searched.reduce((n: number, r) => n + (r.returned ?? 0), 0);
  summary[hub] = { records: frozen.hubs[hub].drawn.length, displayed: byVariant('displayed'), lowercase: byVariant('lowercase'), presentation: byVariant('presentation'), nameLevelDisplayed: nameLevel('displayed'),
    redundantClarifications: evaluated.filter((r) => r.redundantClarification).length, technicalOrUnsupported: searched.filter((r) => !['COMPLETED_WITH_CANDIDATES', 'COMPLETED_NO_CANDIDATES', 'PARTIAL_TRUNCATED'].includes(r.state)).length,
    candidatesReturned: returned, irrelevantCandidates: searched.reduce((n: number, r) => n + (r.irrelevant ?? 0), 0),
    misses: evaluated.filter((r) => !r.found).map((r) => `${r.variant}: ${JSON.stringify(r.input)} -> ${r.redundantClarification ? 'NOT_NAME_SEARCH:' + r.reason : r.state + (r.truncated ? ' (truncated)' : '')}`) };
}));
const OUT = process.argv[2] ?? 'docs/qa/th-search-r1-019a/holdout-results.json';
writeFileSync(OUT, JSON.stringify({ evaluatedAt: new Date().toISOString(), note: 'Diagnostic small-sample evaluation against live hub operations. Not a statistical certification.', summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
