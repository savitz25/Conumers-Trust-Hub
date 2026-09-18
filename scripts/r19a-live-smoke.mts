// TH-SEARCH-R1-019A: bounded LIVE smoke of the real hub name operations through the orchestrator.
import { searchNameCandidates } from '../lib/network/name-candidates/orchestrator.ts';
import { decideNameCandidateSearch } from '../lib/network/name-candidates/decision.ts';
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['Allied', 'Cirta', 'Pure Moving Company', '1-800-Pack-Rat', 'Abbey Delray South', 'Tate Asset Management', 'Rocket Mortgage', 'A Holly Patterson Extended Care Facility', 'zzqx nonexistent 9917'];
const out = [];
for (const q of names) {
  const d = decideNameCandidateSearch(q);
  if (d.operation !== 'NAME_CANDIDATES') { out.push({ q, decision: d }); continue; }
  const r = await searchNameCandidates({ originalInput: d.originalInput, name: d.name, hubScope: d.hubScope, priorityHubs: d.priorityHubs });
  out.push({ q, basis: d.basis, candidateCount: r.candidateCount, timing: r.timing, coverage: r.coverage,
    hubs: r.hubs.map((h) => ({ hub: h.hub, state: h.state, applied: h.nameFilterApplied, n: h.candidates.length, total: h.hubReportedTotal, more: h.hasMore, capped: h.truncatedWithoutCursor, ms: h.latencyMs, calls: h.calls, fail: h.failureKind, top: h.candidates.slice(0, 3).map((c) => `${c.displayName} [${c.matchMethod}] ${c.identifiers.map((i) => i.label + ' ' + i.value).join('/')} -> ${c.action?.href ?? 'NO ACTION'}`) })) });
}
console.log(JSON.stringify(out, null, 1));
