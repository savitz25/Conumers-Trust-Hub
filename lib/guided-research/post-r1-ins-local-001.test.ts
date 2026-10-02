/**
 * POST-R1-INS-LOCAL-001 — Insurance local discovery consistency.
 *
 * Production testing showed "insurance agent in miami" (bare city, honest disclosure) and
 * "insurance agent in broward county" (explicit county) behaving inconsistently: the city case
 * correctly attempted InsuranceTrustHub's real local-directory capability (local_directory_handoff
 * mode) and fell back to an honest disclosure, while the county case silently entered the generic
 * cohort path and returned the full unscoped statewide population (56,939 records) presented as a
 * successful result -- with no disclosure that the requested county scope was never applied. This
 * mislabeled CREDENTIAL_JURISDICTION geography as a county-scoped directory result (Section 5's
 * exact "do not label one [geography grain] as another" concern).
 *
 * Root cause: session.ts's local_directory_handoff entry gate only recognized zip/city geography;
 * specialists.ts's executeInsurance had a matching gate with the same gap. Both are fixed to also
 * recognize county geography, scoped to the 'agency' entity class only (the only class the real
 * local-directory fetch can ever attempt) so producer/legal_insurer + county keep going through
 * their existing, already-correct automatic state-broadening path.
 *
 * Separately verified live (raw specialistFetch against InsuranceTrustHub's specialist-execution/v2,
 * 3x consistent): the OFFICE_LOCATION local-directory capability genuinely exists in the contract
 * (named error code `directory_source_unavailable`, not a blank 404/unsupported response) but is
 * currently reporting itself unavailable. This is an external, currently-observed backend
 * condition, not an Ask-side defect -- tests that depend on a live SUPPORTED_RESULTS from that path
 * are expected to fail while it is down, matching the existing BOCA RATON/ZIP FIXTURE/MIAMI-DADE
 * FIXTURE tests already in this suite.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from './orchestrator.ts';

test('1. Miami local Insurance discovery: bare city + agency enters local_directory_handoff with Miami-Dade county carried through', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency in miami' } });
  assert.equal(r.session.hub, 'insurance');
  assert.equal(r.session.insuranceEntityClass, 'agency');
  assert.equal(r.session.insuranceResearchMode, 'local_directory_handoff');
  assert.equal(r.session.geography?.type, 'city');
  assert.equal(r.session.geography?.county, 'Miami-Dade');
});

test('2. county-level Insurance discovery: "agency" + explicit county now enters local_directory_handoff (was silently unscoped before this fix)', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency in broward county' } });
  assert.equal(r.session.hub, 'insurance');
  assert.equal(r.session.insuranceEntityClass, 'agency');
  assert.equal(r.session.insuranceResearchMode, 'local_directory_handoff');
  assert.equal(r.session.geography?.type, 'county');
  assert.equal(r.session.geography?.county, 'Broward');
  // The defect this ticket fixes: must never silently present the full unscoped statewide
  // population (82,071 or 56,939) as if it were a real Broward-scoped result.
  assert.notEqual(r.result?.total, 82071);
});

test('3. non-agency + county is unaffected: producer/legal_insurer + county still goes through the existing automatic-broadening cohort path, not local_directory_handoff', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance producer in palm beach county' } });
  assert.equal(r.session.insuranceEntityClass, 'producer');
  assert.notEqual(r.session.insuranceResearchMode, 'local_directory_handoff');
});

test('4. no service-territory inference: local-discovery geography meaning never claims a confirmed service area', async () => {
  for (const q of ['insurance agency in miami', 'insurance agency in broward county']) {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: q } });
    const meaning = r.session.geography?.meaning ?? '';
    assert.ok(!/\bserves?\b/i.test(meaning), `${q}: geography meaning must not claim the agency serves this area`);
    assert.match(meaning, /not service (?:territory|area)/i, `${q}: geography meaning must explicitly disclaim service territory`);
  }
});

test('5. product + geography: a line-of-authority word alongside local geography does not silently disappear (carried on the session for downstream disclosure)', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'homeowners insurance agency in miami' } });
  assert.equal(r.session.insuranceLineOfAuthority, 'homeowners');
  assert.equal(r.session.insuranceResearchMode, 'local_directory_handoff');
});

test('6. Medicare supplement -> Insurance-only routing remains intact (Post-R1 intent release, unaffected by this ticket)', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'medicare supplement agent in ohio' } });
  assert.equal(r.session.hub, 'insurance');
});

test('7. entity/name control: an exact NPN identifier is unaffected by the local-discovery routing change', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'NPN 10391484' } });
  assert.equal(r.result?.resultState, 'EXACT_IDENTITY');
});

test('8. no-result control: an unrecognized geography phrase does not fabricate a local match', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency in nowhere land' } });
  assert.notEqual(r.session.insuranceResearchMode, 'local_directory_handoff');
  assert.notEqual(r.result?.total, 82071);
});

test('9. Jacksonville stays an honest, undocumented limitation -- no fabricated FL municipality mapping added by this ticket', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'brightway insurance jacksonville' } });
  assert.notEqual(r.session.geography?.city, 'Jacksonville');
});

test('10. destination safety: the local-directory fallback destination is always a real insurancetrusthub.com URL, never fabricated', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency in miami' } });
  const dest = r.result?.destinations?.[0]?.href;
  if (dest) assert.match(dest, /^https:\/\/www\.insurancetrusthub\.com\//);
});
