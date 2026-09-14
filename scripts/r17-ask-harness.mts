// TH-SEARCH-R1-017: Ask-parent acceptance harness.
// Runs each corpus entry with 'ask' in testSurfaces through the REAL production execution
// path (guided-research orchestrator: createGuidedSession + orchestrateGuidedResearch),
// not the secondary assembleNetworkAnswerWithSpecialist path -- R1-016 proved these can
// disagree and only the guided-research path is what the live /ask page actually renders.
import { readFileSync, writeFileSync } from 'node:fs';
import { createGuidedSession } from '../lib/guided-research/session.ts';
import { orchestrateGuidedResearch } from '../lib/guided-research/orchestrator.ts';
import { decideAskExecution } from '../lib/network/execution-decision.ts';

type CorpusEntry = { id: string; hub: string; query: string; testSurfaces: string[] };
const corpus = JSON.parse(readFileSync('docs/qa/th-search-r1-017/question-corpus.json', 'utf8')) as { entries: CorpusEntry[] };
const entries = corpus.entries.filter((e) => e.testSurfaces.includes('ask'));

const out: Record<string, unknown>[] = [];
for (const entry of entries) {
  const started = Date.now();
  try {
    const decision = decideAskExecution(entry.query);
    const session = createGuidedSession(entry.query);
    let execResult: Record<string, unknown> | null = null;
    let orchestratorPhase: string | undefined;
    let orchestratorHub: string | undefined;
    let identityName: string | undefined;
    if (session) {
      const t0 = Date.now();
      const r = await orchestrateGuidedResearch({ action: { type: 'START', question: entry.query } });
      execResult = {
        latencyMs: Date.now() - t0,
        phase: r.session?.phase,
        resultState: r.result?.resultState,
        consumerHeading: r.result?.consumerHeading,
        consumerMessage: r.result?.consumerMessage,
        total: r.result?.total,
        rowsCount: r.result?.rows?.length,
        firstRows: (r.result?.rows ?? []).slice(0, 3).map((row) => ({ name: row.name, identifier: row.identifier, recordedLocation: row.recordedLocation, whyShown: row.whyShown })),
        limitations: r.result?.limitations,
        destinations: r.result?.destinations,
        refinements: r.result?.refinements?.map((x) => x.id),
        interpretation: r.result?.interpretation,
      };
      orchestratorPhase = r.session?.phase;
      orchestratorHub = r.session?.hub;
      identityName = r.session?.identityName;
    }
    out.push({
      id: entry.id, hub: entry.hub, query: entry.query, surface: 'ask',
      plan: {
        intent: decision.plan.intent, primaryHub: decision.plan.primaryHub,
        candidateHubs: decision.plan.candidateHubs, entityName: decision.plan.entityName,
        entityClass: decision.plan.entityClass, identifier: decision.plan.identifier,
        requestedGeography: decision.plan.requestedGeography, missingSlots: decision.plan.missingSlots,
        executionAllowed: decision.plan.executionAllowed, executionMode: decision.plan.executionMode,
        clarificationReason: decision.plan.clarificationReason,
      },
      scope: { resolutionState: decision.scope.resolutionState, executionAllowed: decision.scope.executionAllowed, disclosure: decision.scope.disclosure, reasonCodes: decision.scope.reasonCodes },
      executionDecision: { mode: decision.mode, executionAllowed: decision.executionAllowed, allowedHubs: decision.allowedHubs },
      guidedSession: session ? { hub: orchestratorHub, phase: orchestratorPhase, identityName, missingFields: session.missingFields } : null,
      execResult,
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    out.push({ id: entry.id, hub: entry.hub, query: entry.query, surface: 'ask', ERROR: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started });
  }
  process.stderr.write(`done: ${entry.id}\n`);
}
writeFileSync('docs/qa/th-search-r1-017/raw-ask-results.json', JSON.stringify(out, null, 2));
console.log(`wrote ${out.length} ask-surface results`);
