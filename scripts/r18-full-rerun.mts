// TH-SEARCH-R1-018: full R1-017 corpus rerun + R1-018 additional paraphrases, against live
// production. Ask-surface entries via the real guided-research orchestrator; direct-surface
// entries via each specialist's own public contract, exactly matching the R1-017 methodology.
import { readFileSync, writeFileSync } from 'node:fs';
import { createGuidedSession } from '../lib/guided-research/session.ts';
import { orchestrateGuidedResearch } from '../lib/guided-research/orchestrator.ts';
import { decideAskExecution } from '../lib/network/execution-decision.ts';

type CorpusEntry = { id: string; hub: string; query: string; testSurfaces: string[] };
const r17 = JSON.parse(readFileSync('docs/qa/th-search-r1-017/question-corpus.json', 'utf8')) as { entries: CorpusEntry[] };
const r18 = JSON.parse(readFileSync('docs/qa/th-search-r1-018/additional-corpus.json', 'utf8')) as { entries: CorpusEntry[] };
const allEntries = [...r17.entries, ...r18.entries];
const askEntries = allEntries.filter((e) => e.testSurfaces.includes('ask'));

const API: Record<string, string> = {
  move: 'https://www.movetrusthub.com/api/ask',
  lender: 'https://www.lendertrusthub.com/api/ask',
  insurance: 'https://www.insurancetrusthub.com/api/ask',
  senior: 'https://www.seniortrusthub.com/api/ask',
  investor: 'https://www.investortrusthub.com/api/ask',
};
async function fetchJson(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    const status = res.status;
    const body = await res.json().catch(async () => ({ __nonJson: (await res.text()).slice(0, 500) }));
    return { status, body, latencyMs: Date.now() - started };
  } catch (error) {
    return { error: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : String(error), latencyMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}
async function fetchHtml(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return { status: res.status, html: text, latencyMs: Date.now() - started };
  } catch (error) {
    return { error: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : String(error), latencyMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

const askOut: Record<string, unknown>[] = [];
for (const entry of askEntries) {
  const started = Date.now();
  try {
    const decision = decideAskExecution(entry.query);
    const session = createGuidedSession(entry.query);
    let execResult: Record<string, unknown> | null = null;
    if (session) {
      const t0 = Date.now();
      const r = await orchestrateGuidedResearch({ action: { type: 'START', question: entry.query } });
      execResult = {
        latencyMs: Date.now() - t0, phase: r.session?.phase, resultState: r.result?.resultState,
        consumerHeading: r.result?.consumerHeading, consumerMessage: r.result?.consumerMessage,
        total: r.result?.total, rowsCount: r.result?.rows?.length,
        firstRows: (r.result?.rows ?? []).slice(0, 3).map((row) => ({ name: row.name, identifier: row.identifier, recordedLocation: row.recordedLocation, whyShown: row.whyShown })),
        limitations: r.result?.limitations, destinations: r.result?.destinations,
        error: r.result?.error,
      };
    }
    askOut.push({
      id: entry.id, hub: entry.hub, query: entry.query, surface: 'ask',
      plan: { intent: decision.plan.intent, primaryHub: decision.plan.primaryHub, candidateHubs: decision.plan.candidateHubs, entityName: decision.plan.entityName, identifier: decision.plan.identifier, executionAllowed: decision.plan.executionAllowed },
      executionDecision: { mode: decision.mode, executionAllowed: decision.executionAllowed },
      guidedSession: session ? { hub: session.hub, phase: session.phase, identityName: session.identityName, identifier: session.identifier } : null,
      execResult, elapsedMs: Date.now() - started,
    });
  } catch (error) {
    askOut.push({ id: entry.id, hub: entry.hub, query: entry.query, surface: 'ask', ERROR: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started });
  }
  process.stderr.write(`ask done: ${entry.id}\n`);
}
writeFileSync('docs/qa/th-search-r1-018/full-r1017-rerun-ask.json', JSON.stringify(askOut, null, 2));

const directEntries = allEntries.filter((e) => e.testSurfaces.includes('direct'));
const directOut: Record<string, unknown>[] = [];
for (const entry of directEntries) {
  if (entry.hub === 'contractor') {
    const url = `https://www.contractortrusthub.com/ask?q=${encodeURIComponent(entry.query)}`;
    const result = await fetchHtml(url);
    directOut.push({ id: entry.id, hub: entry.hub, query: entry.query, surface: 'direct', url, httpStatus: 'status' in result ? result.status : undefined, error: 'error' in result ? result.error : undefined, latencyMs: result.latencyMs, htmlByteLength: 'html' in result ? result.html.length : undefined });
  } else {
    const url = `${API[entry.hub]}?q=${encodeURIComponent(entry.query)}`;
    const result = await fetchJson(url);
    directOut.push({ id: entry.id, hub: entry.hub, query: entry.query, surface: 'direct', url, httpStatus: 'status' in result ? result.status : undefined, error: 'error' in result ? result.error : undefined, latencyMs: result.latencyMs, body: 'body' in result ? result.body : undefined });
  }
  process.stderr.write(`direct done: ${entry.id}\n`);
}
writeFileSync('docs/qa/th-search-r1-018/full-r1017-rerun-direct.json', JSON.stringify(directOut, null, 2));
console.log(`wrote ${askOut.length} ask + ${directOut.length} direct = ${askOut.length + directOut.length} total rerun results`);
