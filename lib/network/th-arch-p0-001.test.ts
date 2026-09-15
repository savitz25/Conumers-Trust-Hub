// TH-ARCH-P0-001: Canonical Search Semantics & Identity Ownership.
//
// Permanent regression coverage for the semantic-competition failure class this ticket
// targets: guided-research/session.ts (and, upstream of it, ask-parse.ts's identifier/geography
// extraction) must not independently re-derive hub/geography/identifier/entity semantics that
// research-planner.ts's AskResearchPlan already decided. See docs/TH-ARCH-P0-001-ARCHITECTURE.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planAskResearch } from './research-planner.ts';
import { createGuidedSession } from '../guided-research/session.ts';

// --- Multi-domain intent must survive before specialist dispatch (ticket section 10) ---

test('ARCH-P0-001: multi-domain query with explicit conjunction preserves both verticals', () => {
  const plan = planAskResearch('I need a mover and a mortgage lender in New Jersey');
  assert.equal(plan.intent, 'MULTI_HUB_JOURNEY');
  assert.ok(plan.candidateHubs.includes('move'), 'move must survive');
  assert.ok(plan.candidateHubs.includes('lender'), 'lender must survive');
  const session = createGuidedSession('I need a mover and a mortgage lender in New Jersey');
  assert.ok(session);
  // No downstream shortcut may silently commit to a single hub for a query the planner
  // recognized as spanning multiple specialist verticals.
  assert.notEqual(session!.hub, 'move');
  assert.notEqual(session!.hub, 'lender');
});

test('ARCH-P0-001: multi-domain query with NO conjunction word still preserves both verticals downstream', () => {
  // No "and"/"plus"/"as well as", no buy/rent/move/relocate/roof-damaged/helping-parent verbs --
  // this deliberately falls outside research-planner.ts's structural MULTI_HUB_JOURNEY gate, so it
  // exercises the guided-session layer's own responsibility not to first-match-wins into one hub.
  const plan = planAskResearch('electrician mortgage lender New Jersey');
  assert.ok(plan.candidateHubs.length > 1, `expected >1 candidate hub, got ${JSON.stringify(plan.candidateHubs)}`);
  const session = createGuidedSession('electrician mortgage lender New Jersey');
  assert.ok(session);
  assert.notEqual(session!.hub, 'contractor');
  assert.notEqual(session!.hub, 'lender');
});

// --- DISCOVERY must be recognized, not treated as a literal entity name (ticket section 6/8) ---

test('ARCH-P0-001: "moving company in Boca Raton" is DISCOVERY (cohort browse), not a literal company name', () => {
  const plan = planAskResearch('moving company in Boca Raton');
  assert.equal(plan.intent, 'COHORT_BROWSE');
  assert.equal(plan.entityClass?.id, 'mover');
  assert.equal(plan.entityName, undefined);
});

test('ARCH-P0-001: "electrician Palm Beach County" is DISCOVERY with trade + geography, not a literal name', () => {
  const plan = planAskResearch('electrician Palm Beach County');
  assert.equal(plan.intent, 'COHORT_BROWSE');
  assert.equal(plan.entityClass?.id, 'electrical_contractor');
  assert.equal(plan.requestedGeography?.county, 'Palm Beach');
  assert.equal(plan.entityName, undefined);
});

test('ARCH-P0-001: "mortgage broker in Monmouth County New Jersey" is provider DISCOVERY, not HMDA aggregate research', () => {
  const plan = planAskResearch('mortgage broker in Monmouth County New Jersey');
  assert.equal(plan.intent, 'COHORT_BROWSE');
  assert.equal(plan.primaryHub, 'lender');
  assert.notEqual(plan.intent, 'HOW_TO');
  assert.equal(plan.requestedEvidence.includes('HMDA'), false);
  assert.equal(plan.entityName, undefined);
});

test('ARCH-P0-001: "senior care Florida" is DISCOVERY with unresolved care class, not a literal provider name', () => {
  const plan = planAskResearch('senior care Florida');
  assert.equal(plan.candidateHubs.includes('senior'), true);
  assert.equal(plan.careSetting, undefined, 'care setting must stay unresolved, not guessed');
  assert.equal(plan.entityName, undefined);
  assert.equal(plan.requestedGeography?.stateCode, 'FL', 'Florida must survive even without a leading preposition');
});

// --- Deictic / contextual identity must not become a literal entity name (ticket section 23) ---

test('ARCH-P0-001: "Who owns this nursing home?" never becomes a literal facility name', () => {
  const plan = planAskResearch('Who owns this nursing home?');
  assert.equal(plan.entityName, undefined);
  assert.notEqual(plan.entityName, 'Who owns this nursing home');
  const session = createGuidedSession('Who owns this nursing home?');
  assert.ok(session);
  assert.equal(session!.identityName, undefined);
});

// --- Journey geography: origin and destination are distinct and both survive (ticket section 22) ---

test('ARCH-P0-001: "moving from Los Angeles to Miami" preserves distinct origin and destination', () => {
  const plan = planAskResearch('moving from Los Angeles to Miami');
  assert.equal(plan.requestedGeography?.kind, 'route');
  assert.equal(plan.requestedGeography?.origin, 'Los Angeles');
  assert.equal(plan.requestedGeography?.destination, 'Miami');
  assert.notEqual(plan.requestedGeography?.origin, plan.requestedGeography?.destination);
});

// --- Identifier natural wording must be bounded: "code"/"number"/"#" never become the value ---

test('ARCH-P0-001: "NAIC code 10064" extracts the NAIC value, not the word "code"', () => {
  const plan = planAskResearch('NAIC code 10064');
  assert.equal(plan.identifier?.type, 'naic_company_code');
  assert.equal(plan.identifier?.value, '10064');
});

test('ARCH-P0-001: "NPN number 123456" extracts the NPN value, not the word "number"', () => {
  const plan = planAskResearch('NPN number 123456');
  assert.equal(plan.identifier?.type, 'npn');
  assert.equal(plan.identifier?.value, '123456');
});

test('ARCH-P0-001: "NMLS number 12345" extracts the NMLS value, not the word "number"', () => {
  const plan = planAskResearch('NMLS number 12345');
  assert.equal(plan.identifier?.type, 'nmls');
  assert.equal(plan.identifier?.value, '12345');
});

test('ARCH-P0-001: "CRD number 67890" extracts the CRD value, not the word "number"', () => {
  const plan = planAskResearch('CRD number 67890');
  assert.equal(plan.identifier?.type, 'crd');
  assert.equal(plan.identifier?.value, '67890');
});

test('ARCH-P0-001: "USDOT 1 234 567" extracts the digits despite internal spacing', () => {
  const plan = planAskResearch('USDOT 1 234 567');
  assert.equal(plan.identifier?.type, 'usdot');
  assert.equal(plan.identifier?.value, '1234567');
});

test('ARCH-P0-001: malformed identifier wording never captures a label word as the value', () => {
  const plan = planAskResearch('What is my NMLS number?');
  assert.notEqual(plan.identifier?.value, 'NUMBER');
  assert.notEqual(plan.identifier?.value, 'number');
});

test('ARCH-P0-001: two distinct USDOT numbers never collide (no fuzzy regulatory identifier match)', () => {
  const a = planAskResearch('USDOT 1234567');
  const b = planAskResearch('USDOT 1234568');
  assert.equal(a.identifier?.value, '1234567');
  assert.equal(b.identifier?.value, '1234568');
  assert.notEqual(a.identifier?.value, b.identifier?.value);
});
