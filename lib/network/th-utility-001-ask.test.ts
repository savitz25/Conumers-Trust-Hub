/**
 * TH-UTILITY-001-ASK: two Ask customer failures.
 * RC29027885 is a published Florida contractor credential, not a company-name search.
 * The NYSDOT intrastate question names a roster Ask has not acquired, so a
 * recorded-headquarters cohort must not be returned as the answer.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch, planRequiresImmediateClarification } from './research-planner.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { createGuidedSession } from '../guided-research/session.ts';
import { orchestrateGuidedResearch } from '../guided-research/orchestrator.ts';
import { CONTRACTOR_CONTRACT_FINGERPRINT, CONTRACTOR_CONTRACT_VERSION, CONTRACTOR_SCHEMA_FINGERPRINT } from '../guided-research/specialists.ts';

const NYSDOT = 'How many intrastate movers are registered with NYSDOT in New York?';
const NYSDOT_REASON = 'Current NYSDOT household-goods roster is not acquired. Search-only is not zero. Florida IM registration is not a substitute. Zero returned rows are not a known zero population.';

test('RC29027885 is a contractor credential and keeps the RC prefix', () => {
  for (const query of ['RC29027885', 'RC 29027885', 'verify contractor license RC29027885']) {
    const parsed = parseNetworkAsk(query);
    assert.equal(parsed.identifier?.family.id, 'state_contractor_license', query);
    assert.equal(parsed.identifier?.raw, 'RC29027885', query);
    assert.deepEqual(parsed.suggestedHubs, ['contractor'], query);
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, 'contractor', query);
    assert.equal(plan.intent, 'IDENTIFIER_LOOKUP', query);
    assert.equal(plan.identifier?.value, 'RC29027885', query);
    assert.equal(plan.executionAllowed, true, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
  const session = createGuidedSession('RC29027885');
  assert.equal(session?.hub, 'contractor');
  assert.equal(session?.phase, 'EXECUTE');
  assert.equal(session?.identifier?.value, 'RC29027885');
});

test('published CBC/CGC/CCC licenses stay contractor credentials, and a short RC token does not', () => {
  assert.equal(parseNetworkAsk('CCC1337629').identifier?.raw, 'CCC1337629');
  assert.equal(parseNetworkAsk('CBC015082').identifier?.family.id, 'state_contractor_license');
  assert.notEqual(parseNetworkAsk('RC123456').identifier?.family.id, 'state_contractor_license');
  assert.notEqual(parseNetworkAsk('CRC123456').identifier?.family.id, 'state_contractor_license');
  assert.equal(parseNetworkAsk('USDOT 125563').identifier?.family.id, 'usdot');
  assert.equal(planAskResearch('USDOT 125563').identifier?.value, '125563');
});

test('NYSDOT intrastate research does not become an executable headquarters cohort', () => {
  const plan = planAskResearch(NYSDOT);
  assert.equal(plan.primaryHub, 'move');
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.clarificationReason, NYSDOT_REASON);
  assert.ok(plan.reasonCodes.includes('MOVE_POPULATION_UNAVAILABLE'));
  assert.equal(planRequiresImmediateClarification(plan), true);
  assert.equal(decideNameCandidateSearch(NYSDOT).operation, 'NOT_NAME_SEARCH');
  const guided = createGuidedSession(NYSDOT);
  assert.equal(guided?.phase, 'CLARIFY');
  assert.equal(guided?.nextAction, NYSDOT_REASON);
  assert.equal(guided?.researchPlan.reasonCodes.includes('MOVE_POPULATION_UNAVAILABLE'), true);
});

test('supported Move research stays executable', () => {
  const headquarters = planAskResearch('Show household-goods carriers headquartered in Florida.');
  assert.equal(headquarters.primaryHub, 'move');
  assert.equal(headquarters.executionAllowed, true);
  assert.equal(headquarters.reasonCodes.includes('MOVE_POPULATION_UNAVAILABLE'), false);
  const best = planAskResearch('best mover in tampa bay florida');
  assert.equal(best.executionAllowed, true);
  assert.equal(best.reasonCodes.includes('MOVE_POPULATION_UNAVAILABLE'), false);
  const serving = planAskResearch('I need movers serving New York');
  assert.equal(serving.reasonCodes.includes('MOVE_POPULATION_UNAVAILABLE'), false);
});

test('guided NYSDOT start and execute retrieve no rows and do not call Move', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error('specialist must not be called');
  }) as typeof fetch;
  try {
    const started = await orchestrateGuidedResearch({ action: { type: 'START', question: NYSDOT } });
    assert.equal(calls, 0);
    assert.equal(started.diagnostics.specialistCalls, 0);
    assert.equal(started.session.hub, 'move');
    assert.equal(started.session.phase, 'CLARIFY');
    assert.equal(started.result?.executionOccurred, false);
    assert.equal(started.result?.resultState, 'UNSUPPORTED_CAPABILITY');
    assert.equal(started.result?.consumerMessage, NYSDOT_REASON);
    assert.equal(started.result?.total, 0);
    assert.deepEqual(started.result?.rows, []);
    assert.match(started.result?.limitations.join(' ') ?? '', /No recorded-headquarters cohort was substituted/);
    const href = started.result?.destinations[0]?.href ?? '';
    assert.match(href, /^https:\/\/www\.movetrusthub\.com\/ask\?q=/);
    assert.match(decodeURIComponent(href.replace(/\+/g, ' ')), /How many intrastate movers are registered with NYSDOT in New York/);
    const retried = await orchestrateGuidedResearch({ session: started.session, action: { type: 'EXECUTE' } });
    assert.equal(calls, 0);
    assert.equal(retried.diagnostics.specialistCalls, 0);
    assert.equal(retried.result?.executionOccurred, false);
    assert.equal(retried.result?.total, 0);
    assert.deepEqual(retried.result?.rows, []);
  } finally {
    globalThis.fetch = original;
  }
});

test('guided RC29027885 asks Contractor for the full credential key', async () => {
  const original = globalThis.fetch;
  let body: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input, init) => {
    body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return new Response(JSON.stringify({
      contract: 'trusthub-specialist-execution-v2',
      contractVersion: CONTRACTOR_CONTRACT_VERSION,
      schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT,
      contractFingerprint: CONTRACTOR_CONTRACT_FINGERPRINT,
      resultState: 'EXACT_IDENTITY',
      rows: [{
        name: '123 ROOFING, INC.',
        credentialNumber: '29027885',
        trade: 'Registered Roofing Contractor',
        status: 'active',
        recordedGeography: { city: 'Coral Springs', county: 'Broward', state: 'FL' },
        source: { system: 'fl_dbpr', label: 'Florida DBPR', observedAt: '2026-08-01' },
        destination: 'https://www.contractortrusthub.com/contractors/rc29027885-123-roofing-inc',
        destinations: [{ type: 'PUBLIC_PROFILE', url: 'https://www.contractortrusthub.com/contractors/rc29027885-123-roofing-inc' }],
      }],
      total: 1,
      pagination: { page: 1, limit: 10, totalPages: 1 },
      provenance: { source: 'Florida DBPR' },
      limitations: ['Credential is not endorsement.'],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await orchestrateGuidedResearch({ action: { type: 'START', question: 'RC29027885' } });
    assert.equal(result.session.hub, 'contractor');
    assert.equal(body?.queryType, 'identifier');
    assert.equal(body?.identifier, 'RC29027885');
    assert.equal(result.result?.resultState, 'EXACT_IDENTITY');
    assert.equal(result.result?.total, 1);
    assert.equal(result.result?.rows[0]?.name, '123 ROOFING, INC.');
    assert.match(result.result?.rows[0]?.destination?.href ?? '', /\/contractors\/rc29027885-123-roofing-inc$/);
  } finally {
    globalThis.fetch = original;
  }
});
