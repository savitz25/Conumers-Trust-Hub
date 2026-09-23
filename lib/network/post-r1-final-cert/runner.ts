/**
 * POST-R1-FINAL-CERT-PREP-001 -- page-order certification runner.
 *
 * Reproduces exactly what `app/ask/page.tsx` decides for a query, in the same order the page does:
 *   1. buildAskResearchRoute + decideAskExecution
 *   2. resolveAskNameState  (network NAME_CANDIDATES search; when it applies it is what renders)
 *   3. securities refusal / multi-hub journey / place lens
 *   4. createGuidedSession, then EXECUTE when the client would (phase EXECUTE, or a CARE_TASK with a
 *      chosen setting and nothing missing)
 *   5. federated NetworkAskResult / route card only
 * and then records the structural facts of the outcome and classifies it into exactly one outcome
 * class. It never retries, never mutates search behavior, and never asserts dynamic counts.
 */
import { buildAskResearchRoute } from '../ask-research-route.ts';
import { decideAskExecution } from '../execution-decision.ts';
import { resolveAskNameState } from '../name-candidates/page-state.ts';
import type { NameCandidateResponse } from '../name-candidates/contract.ts';
import { createGuidedSession } from '../../guided-research/session.ts';
import { orchestrateGuidedResearch } from '../../guided-research/orchestrator.ts';
import type { GuidedExecutionResult, GuidedResearchSession } from '../../guided-research/contract.ts';
import type { SpecialistHubId } from '../registry.ts';
import {
  DESTINATION_HOST_ALLOWLIST, FORBIDDEN_CLAIMS, OUTCOME_CLASSES, SOURCE_GRAIN_RULES, certMode,
  type AcceptableOutcomeClass, type CertMode, type OutcomeClass, type PackEntry,
} from './pack.ts';

export type CertSurface = 'NAME_CANDIDATES' | 'GUIDED' | 'JOURNEY' | 'ROUTE_CARD_ONLY' | 'NETWORK_ASK' | 'SECURITIES_REFUSAL' | 'THREW';
export type CertStatus = 'PASS' | 'KNOWN_LIMITATION' | 'PENDING_RELEASE' | 'FAIL';
export type CertGeography = { kind?: string; display?: string; stateCode?: string; county?: string; city?: string; meaning?: string };

export type CertRecord = {
  id: string; query: string; hub: PackEntry['hub']; kind: PackEntry['kind']; mode: CertMode; checkedAt: string; latencyMs: number;
  surface: CertSurface;
  vertical: string | null;
  offeredHubs: string[];
  entity: string | null;
  identifier: { type: string; value: string } | null;
  product: Record<string, string>;
  geography: { requested?: CertGeography; executed?: CertGeography; session?: CertGeography; resolutionState?: string };
  capability: string;
  resultState: string | null;
  resultShape: 'ROWS' | 'ZERO' | 'NONE';
  total: number | null;
  choices: string[];
  nextActions: Array<{ type: string; label: string; href?: string; value?: string }>;
  destinations: string[];
  failure: { kind: 'timeout' | 'unavailable' | 'thrown' | 'unsupported' | null; code?: string; message?: string };
  disclosures: string[];
  outcomeClass: OutcomeClass;
  classDetail: string;
  violations: string[];
  status: CertStatus;
  statusReason: string;
  knownLimitation?: PackEntry['knownLimitation'];
  limitationHub?: PackEntry['limitationHub'];
  pendingRelease?: PackEntry['pendingRelease'];
};

const GRAIN: Record<string, number> = { zip: 4, city: 3, county: 2, state: 1, region: 0 };
const A: AcceptableOutcomeClass = 'SOURCE_BACKED_RESULT', B: AcceptableOutcomeClass = 'DETERMINISTIC_CLARIFICATION', C: AcceptableOutcomeClass = 'HONEST_UNSUPPORTED_WITH_NEXT_ACTION', D: AcceptableOutcomeClass = 'SOURCE_UNAVAILABLE_WITH_FAIL_CLOSED_NEXT_ACTION';

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const norm = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function geo(g: { kind?: string; type?: string; display?: string; value?: string; stateCode?: string; county?: string; city?: string; meaning?: string } | undefined): CertGeography | undefined {
  if (!g) return undefined;
  return { kind: g.kind ?? g.type, display: g.display ?? g.value, stateCode: g.stateCode, county: g.county, city: g.city, meaning: g.meaning };
}

function hrefViolations(hrefs: string[]): string[] {
  const out: string[] = [];
  for (const href of hrefs) {
    if (!href) { out.push('BROKEN_HANDOFF: empty href'); continue; }
    if (/localhost|vercel\.app|token=|email=|user_id=/i.test(href)) { out.push(`BROKEN_HANDOFF: private/unsafe href ${href}`); continue; }
    if (href.startsWith('/ask?')) continue;
    let url: URL;
    try { url = new URL(href); } catch { out.push(`BROKEN_HANDOFF: unparsable href ${href}`); continue; }
    if (url.protocol !== 'https:') out.push(`BROKEN_HANDOFF: non-https href ${href}`);
    if (!DESTINATION_HOST_ALLOWLIST.has(url.hostname)) out.push(`BROKEN_HANDOFF: host not allowlisted ${url.hostname}`);
    if (url.pathname === '/ask' && !url.searchParams.get('q')) out.push(`BROKEN_HANDOFF: specialist /ask handoff lost the query context ${href}`);
  }
  return out;
}

type Raw = {
  surface: CertSurface; latencyMs: number; routeDestinations: string[]; routeStatus: string; decisionMode: string;
  name?: NameCandidateResponse; session?: GuidedResearchSession; result?: GuidedExecutionResult; thrown?: string;
  journeyHubs?: string[];
};

async function runPageOrder(query: string): Promise<Raw> {
  const started = performance.now();
  const route = buildAskResearchRoute(query);
  const decision = decideAskExecution(query, route.plan);
  const base = { routeDestinations: route.destinations.map((d) => d.href), routeStatus: route.status, decisionMode: decision.mode };
  const nameState = await resolveAskNameState({ query, plan: route.plan, selectedHub: null, interpretAs: null });
  if (nameState.mode === 'NAME_RESULTS') return { ...base, surface: 'NAME_CANDIDATES', name: nameState.response, latencyMs: Math.round(performance.now() - started) };
  if (route.plan.reasonCodes.includes('UNSUPPORTED_SECURITIES_ADVICE')) return { ...base, surface: 'SECURITIES_REFUSAL', latencyMs: Math.round(performance.now() - started) };
  if (route.journey) return { ...base, surface: 'JOURNEY', journeyHubs: route.journey.orderedHubs, routeDestinations: route.journey.steps.flatMap((s) => s.destinations.map((d) => d.href)), latencyMs: Math.round(performance.now() - started) };
  if (decision.mode === 'PLACE_LENS') return { ...base, surface: 'NETWORK_ASK', latencyMs: Math.round(performance.now() - started) };
  const guided = createGuidedSession(query);
  if (!guided) return { ...base, surface: decision.executionAllowed ? 'NETWORK_ASK' : 'ROUTE_CARD_ONLY', latencyMs: Math.round(performance.now() - started) };
  const clientExecutes = guided.phase === 'EXECUTE' || (guided.researchPlan.reasonCodes.includes('CARE_TASK') && Boolean(guided.researchPlan.careSetting) && !guided.missingFields.length);
  if (!clientExecutes) return { ...base, surface: 'GUIDED', session: guided, latencyMs: Math.round(performance.now() - started) };
  try {
    const response = await orchestrateGuidedResearch({ session: guided, action: { type: 'EXECUTE' } });
    return { ...base, surface: 'GUIDED', session: response.session, result: response.result, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { ...base, surface: 'THREW', session: guided, thrown: error instanceof Error ? error.message : String(error), latencyMs: Math.round(performance.now() - started) };
  }
}

function productOf(s: GuidedResearchSession | undefined): Record<string, string> {
  if (!s) return {};
  const p: Record<string, string> = {};
  // providerClass is only set for a CMS-sourced class; the consumer's requested care setting (memory care,
  // assisted living) lives on the plan and is recorded separately so an unsourced class is never claimed as executable.
  for (const [k, v] of Object.entries({ loanType: s.loanType, trade: s.trade, providerClass: s.providerClass, careSetting: s.researchPlan.careSetting, lineOfAuthority: s.insuranceLineOfAuthority, insuranceEntityClass: s.insuranceEntityClass, investorFirmClass: s.investorFirmClass, moveMode: s.moveMode, entityClass: s.entityClass, researchMode: s.insuranceResearchMode ?? s.lenderResearchMode ?? s.investorResearchMode })) if (v) p[k] = String(v);
  return p;
}

function classifyGuided(s: GuidedResearchSession, r: GuidedExecutionResult | undefined, routeDestinations: string[]): { cls: OutcomeClass; detail: string } {
  const na = (r?.nextActions ?? s.nextActions ?? []);
  const hasNext = na.length > 0 || (r?.destinations.length ?? 0) > 0 || routeDestinations.length > 0;
  if (r) {
    switch (r.resultState) {
      case 'SUPPORTED_RESULTS': case 'EXACT_IDENTITY': return { cls: A, detail: `${r.resultState} rows=${r.rows.length}` };
      case 'ZERO_MATCHING_ROWS': case 'NO_CONFIDENT_MATCH': return hasNext ? { cls: A, detail: `${r.resultState} (source-backed zero)` } : { cls: 'BROKEN_HANDOFF', detail: `${r.resultState} with no next action` };
      case 'AMBIGUOUS_IDENTITIES': case 'IDENTITY_COLLISION': case 'CLARIFICATION_REQUIRED': case 'INVALID_GEOGRAPHY':
        return s.availableChoices.length || na.length ? { cls: B, detail: r.resultState } : { cls: 'BROKEN_HANDOFF', detail: `${r.resultState} with no choices/next action` };
      case 'UNSUPPORTED_STATE_CAPABILITY': case 'UNSUPPORTED_TRADE_CAPABILITY': case 'UNSUPPORTED_CAPABILITY': case 'PUBLICATION_RESTRICTED': case 'INVALID_QUERY':
        return hasNext || s.availableChoices.length ? { cls: C, detail: `${r.resultState}${r.error?.code ? ` (${r.error.code})` : ''}` } : { cls: 'BROKEN_HANDOFF', detail: `${r.resultState} with no next action` };
      case 'BACKEND_UNAVAILABLE': return hasNext ? { cls: D, detail: `BACKEND_UNAVAILABLE${r.error?.code ? ` (${r.error.code})` : ''}` } : { cls: 'BROKEN_HANDOFF', detail: 'BACKEND_UNAVAILABLE with no next action' };
      case 'TIMEOUT': return { cls: 'TECHNICAL_TIMEOUT', detail: `TIMEOUT after ${r.latencyMs}ms` };
      default: return { cls: 'INVALID_GUIDED_SESSION', detail: `unknown resultState ${String(r.resultState)}` };
    }
  }
  const asksForInput = s.availableChoices.length > 0 || s.missingFields.length > 0 || na.some((a) => a.type === 'ENTER_ENTITY_NAME' || a.type === 'ENTER_IDENTIFIER' || a.type === 'SELECT_GEOGRAPHY' || a.type === 'SELECT_ENTITY' || a.type === 'CONSENT_BROADENING');
  if (s.phase === 'CLARIFY' || s.phase === 'COLLECT') {
    if (asksForInput) return { cls: B, detail: `${s.phase}: ${s.missingFields.join(',') || s.availableChoices.length + ' choices'}` };
    if (s.nextAction && hasNext) return { cls: C, detail: `${s.phase}: ${s.nextAction.slice(0, 80)}` };
    return { cls: 'BROKEN_HANDOFF', detail: `${s.phase} dead end: no choices, no next action -- "${(s.nextAction ?? '').slice(0, 80)}"` };
  }
  return { cls: 'INVALID_GUIDED_SESSION', detail: `unexpected phase ${s.phase} without a result` };
}

function classifyName(n: NameCandidateResponse): { cls: OutcomeClass; detail: string } {
  if (n.candidateCount > 0) return { cls: A, detail: `NAME_CANDIDATES ${n.candidateCount} across ${n.hubs.filter((h) => h.candidates.length).map((h) => h.hub).join('+')}` };
  if (n.coverage.genuineNetworkMiss) return { cls: A, detail: 'NAME_CANDIDATES genuine network miss (all in-scope hubs completed)' };
  if (n.coverage.incompleteHubs.length) return { cls: D, detail: `NAME_CANDIDATES incomplete: ${n.coverage.incompleteHubs.join(',')}` };
  return { cls: C, detail: `NAME_CANDIDATES zero with unsupported/restricted hubs: ${[...n.coverage.unsupportedHubs, ...n.coverage.policyRestrictedHubs].join(',')}` };
}

export async function runCertQuery(entry: PackEntry, options: { mode?: CertMode } = {}): Promise<CertRecord> {
  const mode = options.mode ?? certMode();
  const raw = await runPageOrder(entry.query);
  const s = raw.session, r = raw.result, n = raw.name;
  const violations: string[] = [];
  const disclosures: string[] = [];
  const hrefs: string[] = [...raw.routeDestinations];
  let cls: OutcomeClass, detail: string;
  let vertical: string | null = null, offeredHubs: string[] = [], entity: string | null = null, identifier: CertRecord['identifier'] = null;
  let capability: string = raw.surface, resultState: string | null = null, resultShape: CertRecord['resultShape'] = 'NONE', total: number | null = null;
  let choices: string[] = [], nextActions: CertRecord['nextActions'] = [], destinations: string[] = [];
  const geography: CertRecord['geography'] = {};
  const failure: CertRecord['failure'] = { kind: null };

  if (raw.surface === 'NAME_CANDIDATES' && n) {
    ({ cls, detail } = classifyName(n));
    const withCandidates = n.hubs.filter((h) => h.candidates.length).map((h) => h.hub);
    vertical = withCandidates.join('+') || null; offeredHubs = n.coverage.searchedHubs; entity = n.request.name;
    capability = `name-candidates:${n.request.hubScope}`; resultState = 'NAME_CANDIDATES'; resultShape = n.candidateCount ? 'ROWS' : 'ZERO'; total = n.candidateCount;
    for (const h of n.hubs) {
      if (h.message) disclosures.push(`${h.hub}: ${h.message}`);
      if (h.state === 'TECHNICAL_FAILURE') failure.kind = h.failureKind === 'timeout' ? 'timeout' : 'unavailable';
      for (const c of h.candidates) {
        if (c.action) { hrefs.push(c.action.href); destinations.push(c.action.href); }
        if (c.locationMeaning) disclosures.push(`${h.hub}: ${c.locationMeaning}`);
        if (c.recordedLocation && !(c.locationMeaning && /not (?:service territory|client geography|a confirmed service area|current availability)|separate from the credential/i.test(c.locationMeaning))) violations.push(`SOURCE_GRAIN: ${h.hub} candidate "${c.displayName}" records a location without a grain disclosure`);
        if (c.hubMatchExplanation) disclosures.push(c.hubMatchExplanation);
      }
    }
    if (typeof entry.expectedVertical === 'string' && n.candidateCount > 0 && !withCandidates.includes(entry.expectedVertical)) { cls = 'WRONG_VERTICAL'; detail = `expected ${entry.expectedVertical} among candidate hubs, got ${withCandidates.join('+') || 'none'}`; }
    if (entry.expectMatch && n.candidateCount === 0) { cls = 'FALSE_NO_MATCH'; detail = 'a known entity returned zero name candidates'; }
  } else if (raw.surface === 'JOURNEY') {
    offeredHubs = raw.journeyHubs ?? []; capability = 'journey';
    ({ cls, detail } = raw.routeDestinations.length ? { cls: B, detail: `JOURNEY ${offeredHubs.join('>')}` } : { cls: 'BROKEN_HANDOFF', detail: 'journey with no step destinations' });
    destinations = raw.routeDestinations;
  } else if (raw.surface === 'SECURITIES_REFUSAL') {
    ({ cls, detail } = { cls: C, detail: 'securities-advice refusal' }); destinations = raw.routeDestinations;
  } else if (raw.surface === 'NETWORK_ASK' || raw.surface === 'ROUTE_CARD_ONLY') {
    destinations = raw.routeDestinations;
    ({ cls, detail } = raw.routeDestinations.length ? { cls: raw.surface === 'NETWORK_ASK' ? B : C, detail: `${raw.surface}: ${raw.routeStatus}` } : { cls: 'BROKEN_HANDOFF', detail: `${raw.surface} with no destinations` });
  } else if (raw.surface === 'THREW' || !s) {
    ({ cls, detail } = { cls: 'INVALID_GUIDED_SESSION', detail: `threw ${raw.thrown ?? 'unknown'}` }); failure.kind = 'thrown'; failure.message = raw.thrown;
  } else {
    ({ cls, detail } = classifyGuided(s, r, raw.routeDestinations));
    vertical = s.hub ?? null; offeredHubs = s.hub ? [s.hub] : s.availableChoices.filter((c) => c.value.startsWith('hub:')).map((c) => c.value.slice(4));
    entity = s.identityName ?? null; identifier = s.identifier ?? null;
    capability = `guided:${s.hub ?? 'multi-hub'}${s.insuranceResearchMode ? ':' + s.insuranceResearchMode : s.lenderResearchMode ? ':' + s.lenderResearchMode : s.investorResearchMode ? ':' + s.investorResearchMode : s.moveMode ? ':' + s.moveMode : s.providerClass ? ':' + s.providerClass : s.trade ? ':' + s.trade : ''}`;
    resultState = r?.resultState ?? null; resultShape = r ? (r.rows.length ? 'ROWS' : 'ZERO') : 'NONE'; total = r ? r.total : null;
    choices = s.availableChoices.map((c) => c.value);
    nextActions = (r?.nextActions ?? s.nextActions).map((a) => ({ type: a.type, label: a.label, href: a.href, value: a.value }));
    destinations = r?.destinations.map((d) => d.href) ?? [];
    hrefs.push(...destinations, ...nextActions.map((a) => a.href).filter((h): h is string => Boolean(h)), ...(r?.rows ?? []).map((row) => row.destination?.href).filter((h): h is string => Boolean(h)));
    geography.requested = geo(s.executionScope.normalizedRequestedGeography ?? s.executionScope.requestedGeography);
    geography.executed = geo(s.executionScope.executionGeography);
    geography.session = geo(s.geography);
    geography.resolutionState = s.executionScope.resolutionState;
    if (r?.error) { failure.code = r.error.code; failure.kind = r.resultState === 'TIMEOUT' ? 'timeout' : r.resultState === 'BACKEND_UNAVAILABLE' ? 'unavailable' : 'unsupported'; failure.message = r.consumerMessage; }
    disclosures.push(text(r?.consumerHeading), text(r?.consumerMessage), ...(r?.limitations ?? []), ...(r?.interpretation ?? []).map((i) => `${i.label}: ${i.value}`), text(s.nextAction), text(s.geography?.meaning), text(s.executionScope.disclosure), ...(r?.rows ?? []).slice(0, 3).map((row) => row.whyShown), r?.error?.code ? `limitation code: ${r.error.code}` : '');

    // WRONG_VERTICAL
    if (typeof entry.expectedVertical === 'string' && s.hub && s.hub !== entry.expectedVertical) { cls = 'WRONG_VERTICAL'; detail = `expected ${entry.expectedVertical}, routed to ${s.hub}`; }
    if (Array.isArray(entry.expectedVertical) && !s.hub && !entry.expectedVertical.every((h) => offeredHubs.includes(h))) { cls = 'WRONG_VERTICAL'; detail = `multi-hub picker must offer ${entry.expectedVertical.join('+')}, offered ${offeredHubs.join('+')}`; }
    if (typeof entry.expectedVertical === 'string' && !s.hub && cls === B && !offeredHubs.includes(entry.expectedVertical)) { cls = 'WRONG_VERTICAL'; detail = `expected ${entry.expectedVertical} to be a single hub or among offered hubs (${offeredHubs.join('+')})`; }
    // WHOLE_SENTENCE_AS_ENTITY
    if (entity && norm(entity) === norm(entry.query) && /^(?:is|are|was|were|verify|check|find|research|who|what|does|do|can|should)\b/i.test(entry.query)) { cls = 'WHOLE_SENTENCE_AS_ENTITY'; detail = `entity "${entity}" is the whole sentence`; }
    if (entry.expectedEntityContains && !(entity ?? '').toLowerCase().includes(entry.expectedEntityContains)) violations.push(`ENTITY: expected entity to contain "${entry.expectedEntityContains}", got "${entity ?? ''}"`);
    // WRONG_IDENTIFIER_CLASS
    if (entry.expectedIdentifierType && (identifier?.type ?? '').toLowerCase() !== entry.expectedIdentifierType.toLowerCase()) { cls = 'WRONG_IDENTIFIER_CLASS'; detail = `expected identifier type ${entry.expectedIdentifierType}, got ${identifier?.type ?? 'none'}`; }
    // FALSE_NO_MATCH: only a genuine source-backed zero counts -- a timeout/outage/unsupported state is its own class.
    if (entry.expectMatch && r && resultShape === 'ZERO' && (r.resultState === 'ZERO_MATCHING_ROWS' || r.resultState === 'NO_CONFIDENT_MATCH')) { cls = 'FALSE_NO_MATCH'; detail = `known entity/identifier returned ${r.resultState} with zero rows`; }
    // FABRICATED_LOCAL_SCOPE: executed grain coarser than requested must be disclosed as such.
    const req = geography.requested, exe = geography.executed;
    if (r && resultShape === 'ROWS' && req?.kind && exe?.kind && (GRAIN[req.kind] ?? 0) > (GRAIN[exe.kind] ?? 0)) {
      const labels = (r.interpretation ?? []).map((i) => i.label.toLowerCase());
      const disclosed = (labels.some((l) => /you asked/.test(l)) && labels.some((l) => /research executed|selected research scope/.test(l))) || (req.display ? r.consumerMessage.includes(req.display) : false) || r.limitations.some((l) => req.display ? l.includes(req.display) : false);
      if (!disclosed) { cls = 'FABRICATED_LOCAL_SCOPE'; detail = `requested ${req.kind} (${req.display}) but executed ${exe.kind} (${exe.display}) without disclosure`; }
    }
    if (s.hub === 'insurance' && s.insuranceResearchMode === 'local_directory_handoff' && r?.resultState === 'SUPPORTED_RESULTS' && !/recorded (?:directory )?address|not a confirmed service area/i.test(r.consumerMessage)) { cls = 'FABRICATED_LOCAL_SCOPE'; detail = 'insurance local-directory rows without the recorded-address disclosure'; }
    // Geography expectations (structural, on the plan/session -- execution may legitimately broaden).
    const g = geography.requested ?? geography.session;
    if (entry.expectedGeography?.stateCode && g?.stateCode !== entry.expectedGeography.stateCode) violations.push(`GEOGRAPHY: expected state ${entry.expectedGeography.stateCode}, got ${g?.stateCode ?? 'none'}`);
    if (entry.expectedGeography?.county && ![geography.requested?.county, geography.session?.county].includes(entry.expectedGeography.county)) violations.push(`GEOGRAPHY: expected county ${entry.expectedGeography.county}, got ${geography.requested?.county ?? geography.session?.county ?? 'none'}`);
    if (entry.expectedGeography?.city && ![geography.requested?.city, geography.session?.city].includes(entry.expectedGeography.city)) violations.push(`GEOGRAPHY: expected city ${entry.expectedGeography.city}, got ${geography.requested?.city ?? geography.session?.city ?? 'none'}`);
    const product = productOf(s);
    for (const [k, v] of Object.entries(entry.expectedProduct ?? {})) if (product[k] !== v) violations.push(`PRODUCT: expected ${k}=${v}, got ${product[k] ?? 'none'}`);
    // Section 4 source-grain rules apply whenever the hub returned rows.
    if (s.hub && resultShape === 'ROWS') for (const rule of SOURCE_GRAIN_RULES[s.hub as SpecialistHubId] ?? []) if (!disclosures.some((d) => rule.pattern.test(d))) violations.push(`SOURCE_GRAIN: ${s.hub} rows shown without "${rule.rule}" disclosure`);
  }

  const joined = disclosures.filter(Boolean).join('\n');
  // Forbidden claims are AFFIRMATIVE claims: a sentence that negates them ("does not mean this agency
  // serves every customer", "missing evidence is not a clean history") is exactly the disclosure we want.
  const affirmative = joined.split(/(?<=[.;!?])\s+|\n/).filter((sentence) => !/\b(?:not|never|no|isn'?t|doesn'?t|don'?t|cannot|can'?t|rather than|instead of)\b/i.test(sentence));
  for (const claim of FORBIDDEN_CLAIMS) {
    const hit = affirmative.find((sentence) => claim.pattern.test(sentence));
    if (!hit) continue;
    if (claim.code) { cls = claim.code; detail = `${claim.rule}: "${hit.match(claim.pattern)?.[0]}"`; } else violations.push(`SOURCE_GRAIN: ${claim.rule} -- "${hit.match(claim.pattern)?.[0]}"`);
  }
  const handoff = hrefViolations([...new Set(hrefs)]);
  violations.push(...handoff);
  if (handoff.length && (OUTCOME_CLASSES as readonly string[]).includes(cls)) { cls = 'BROKEN_HANDOFF'; detail = handoff[0]; }
  if (entry.requiredDisclosure && !entry.requiredDisclosure.test(joined) && !(entry.knownLimitation === 'CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP')) {
    // A known limitation only stays "known" while it is honestly disclosed on the surface.
    if (cls === 'TECHNICAL_TIMEOUT' && entry.pendingRelease) { /* timeout pre-empted the disclosure; pending-release handling decides */ }
    else violations.push(`DISCLOSURE: known limitation ${entry.knownLimitation} is no longer disclosed (expected ${entry.requiredDisclosure})`);
  }

  const acceptable = (OUTCOME_CLASSES as readonly string[]).includes(cls);
  let status: CertStatus, statusReason: string;
  if (acceptable && entry.accept.includes(cls as AcceptableOutcomeClass) && !violations.length) { status = 'PASS'; statusReason = entry.knownLimitation ? `acceptable (${cls}); known limitation ${entry.knownLimitation} honestly disclosed` : `acceptable (${cls})`; }
  else if (entry.tolerate?.includes(cls) && !violations.length) { status = 'KNOWN_LIMITATION'; statusReason = `${cls} tolerated under ${entry.knownLimitation}`; }
  else if (mode === 'prep' && entry.tolerateUntilRelease?.includes(cls) && !violations.filter((v) => !v.startsWith('DISCLOSURE')).length) { status = 'PENDING_RELEASE'; statusReason = `${cls} tolerated in prep mode pending ${entry.pendingRelease}`; }
  else { status = 'FAIL'; statusReason = violations.length ? violations.join(' | ') : `${cls} not in accepted [${entry.accept.join(', ')}]`; }

  return {
    id: entry.id, query: entry.query, hub: entry.hub, kind: entry.kind, mode, checkedAt: new Date().toISOString(), latencyMs: raw.latencyMs,
    surface: raw.surface, vertical, offeredHubs, entity, identifier, product: productOf(s), geography, capability, resultState, resultShape, total,
    choices, nextActions, destinations, failure, disclosures: disclosures.filter(Boolean), outcomeClass: cls, classDetail: detail, violations, status, statusReason,
    knownLimitation: entry.knownLimitation, limitationHub: entry.limitationHub, pendingRelease: entry.pendingRelease,
  };
}

export type FlowStep = { action: string; ok: boolean; hub?: string; phase?: string; choices: string[]; nextActions: string[]; nextAction?: string; resultState?: string; error?: string };

/** Section 7 step 5 -- the multi-hub choice flow: START -> choose a hub -> (optional) choose a class. */
export async function runMultiHubFlow(query: string, selections: string[]): Promise<{ steps: FlowStep[]; sessionValid: boolean; deadEnd: boolean }> {
  const steps: FlowStep[] = [];
  const snapshot = (action: string, s: GuidedResearchSession, r?: GuidedExecutionResult): FlowStep => ({ action, ok: true, hub: s.hub, phase: s.phase, choices: s.availableChoices.map((c) => c.value), nextActions: (r?.nextActions ?? s.nextActions).map((a) => a.type), nextAction: s.nextAction?.slice(0, 120), resultState: r?.resultState });
  let session: GuidedResearchSession;
  try {
    const start = await orchestrateGuidedResearch({ action: { type: 'START', question: query } });
    session = start.session; steps.push(snapshot('START', start.session, start.result));
  } catch (error) { steps.push({ action: 'START', ok: false, choices: [], nextActions: [], error: error instanceof Error ? error.message : String(error) }); return { steps, sessionValid: false, deadEnd: true }; }
  for (const value of selections) {
    try {
      const next = await orchestrateGuidedResearch({ session, action: { type: 'SELECT_CHOICE', value } });
      session = next.session; steps.push(snapshot(`SELECT_CHOICE ${value}`, next.session, next.result));
    } catch (error) { steps.push({ action: `SELECT_CHOICE ${value}`, ok: false, choices: [], nextActions: [], error: error instanceof Error ? error.message : String(error) }); return { steps, sessionValid: false, deadEnd: true }; }
  }
  const last = steps[steps.length - 1];
  const deadEnd = !last.resultState && last.choices.length === 0 && last.nextActions.length === 0 && (last.phase === 'CLARIFY' || last.phase === 'COLLECT') && !/\?$/.test(last.nextAction ?? '');
  return { steps, sessionValid: true, deadEnd };
}
