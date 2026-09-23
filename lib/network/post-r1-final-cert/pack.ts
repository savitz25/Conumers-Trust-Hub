/**
 * POST-R1-FINAL-CERT-PREP-001 -- the FROZEN Post-R1 cross-hub certification query pack.
 *
 * Every query here is a real consumer phrasing observed during Founder production testing or an
 * already-certified R1 control; none is a synthetic developer-only case. Each must end in exactly
 * one ACCEPTABLE outcome class (see OUTCOME_CLASSES). Known honest limitations (Section 5 of the
 * ticket) are tolerated in every mode as long as they remain honestly disclosed; items that are
 * pending a release (Contractor cold-path / Ask PR #194) are tolerated ONLY in `prep` mode and
 * become blocking in `final` mode.
 *
 * Counts are recorded, never asserted -- the pack is structural on purpose.
 */
import type { SpecialistHubId } from '../registry.ts';

export const OUTCOME_CLASSES = [
  'SOURCE_BACKED_RESULT',
  'DETERMINISTIC_CLARIFICATION',
  'HONEST_UNSUPPORTED_WITH_NEXT_ACTION',
  'SOURCE_UNAVAILABLE_WITH_FAIL_CLOSED_NEXT_ACTION',
] as const;
export type AcceptableOutcomeClass = (typeof OUTCOME_CLASSES)[number];

export const UNACCEPTABLE_CLASSES = [
  'WRONG_VERTICAL',
  'FALSE_NO_MATCH',
  'INVALID_GUIDED_SESSION',
  'WHOLE_SENTENCE_AS_ENTITY',
  'FABRICATED_LOCAL_SCOPE',
  'SERVICE_TERRITORY_INFERENCE',
  'TECHNICAL_TIMEOUT',
  'BROKEN_HANDOFF',
  'WRONG_IDENTIFIER_CLASS',
] as const;
export type UnacceptableOutcomeClass = (typeof UNACCEPTABLE_CLASSES)[number];
export type OutcomeClass = AcceptableOutcomeClass | UnacceptableOutcomeClass;

export const CERT_MODES = ['prep', 'final'] as const;
export type CertMode = (typeof CERT_MODES)[number];
export function certMode(): CertMode {
  const raw = process.env.POST_R1_CERT_MODE;
  return raw === 'final' ? 'final' : 'prep';
}

/** Section 5 -- frozen honest limitations. Never fail certification while honestly disclosed. */
export const KNOWN_LIMITATIONS = {
  AVANTE_SIX_CHARACTER_AMBIGUITY: 'A bare six-character name/identifier string is ambiguous for SeniorTrustHub (nursing-home CCN vs Home Health CCN vs name); Senior reports UNSUPPORTED_OPERATION with an explicit disclosure instead of guessing.',
  FL_ELECTRICAL_SOURCE_GAP: 'Florida electrical-specific credential data is not in the CILB source; Ask either offers trade choices or clearly-labeled broader general/building contractor records, never relabeled as electricians.',
  NJ_LOCAL_CONTRACTOR_MUNICIPALITY: 'New Jersey contractor research is state-grain only; municipality-level local filtering is not supported and is disclosed.',
  CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP: 'Memory care and assisted living are not in CMS Care Compare (Nursing Home / Home Health / Hospice only); Ask routes and labels them but fails closed with a state-specific-source disclosure.',
  HOME_HEALTH_COUNTY_SERVICE_AREA: 'Home Health county-grain execution is unsupported by the specialist contract; office geography is not patient service area, and the state-level broadening is offered as an explicit consent action.',
  INSURANCE_JACKSONVILLE_CROSSWALK_GAP: 'Jacksonville is not in the Florida municipality crosswalk; "brightway insurance jacksonville" is searched whole as a name (entity + location are not decomposed) and reports an honest network miss rather than a fabricated match.',
  LENDER_MISSING_PUBLIC_DESTINATION: 'Some Lender rows have no deterministic public LenderTrustHub profile mapping; Ask omits the destination rather than name-matching loosely.',
  CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP: 'Contractor exact-identifier lookups can exceed Ask\'s specialist budget on a cold Contractor path; tracked separately (Contractor cold-path stabilization).',
} as const;
export type KnownLimitationId = keyof typeof KNOWN_LIMITATIONS;

/** Work still pending release when this pack was frozen. Tolerated in `prep` mode only. */
export const PENDING_RELEASES = {
  CONTRACTOR_COLD_PATH_STABILIZATION: 'ContractorTrustHub cold-path stabilization (Builder 2). First-touch Contractor requests can exceed Ask\'s specialist budget and surface as TIMEOUT.',
  ASK_PR_194_TIMEOUT_FALLBACK: 'Ask PR #194 -- raise the internal Contractor budget 8000ms->10000ms and add a direct-Contractor fallback link on timeout.',
} as const;
export type PendingReleaseId = keyof typeof PENDING_RELEASES;

export type PackHub = SpecialistHubId | 'network';
export type PackKind =
  | 'identity' | 'identifier' | 'cohort_local' | 'cohort_state' | 'product_local'
  | 'multi_hub' | 'no_result' | 'unsupported_source' | 'ambiguous_name';

export type PackEntry = {
  id: string;
  hub: PackHub;
  kind: PackKind;
  query: string;
  /** Guided hub, or -- for multi-hub clarifications -- hubs that must be among the offered choices. */
  expectedVertical?: SpecialistHubId | SpecialistHubId[];
  /** Guided identifier type (session.identifier.type) that must be recognized. */
  expectedIdentifierType?: string;
  /** Entity name must be carried (never the whole sentence) and must resolve to >=1 source-backed record. */
  expectMatch?: boolean;
  /** Substring the extracted entity must contain (lower-cased). */
  expectedEntityContains?: string;
  expectedGeography?: { stateCode?: string; county?: string; city?: string };
  expectedProduct?: { loanType?: string; trade?: string; providerClass?: string; careSetting?: string; lineOfAuthority?: string; insuranceEntityClass?: string };
  accept: AcceptableOutcomeClass[];
  knownLimitation?: KnownLimitationId;
  /** Hub the known limitation belongs to when the entry itself is a network-level query (matrix attribution only). */
  limitationHub?: SpecialistHubId;
  /** Outcome classes tolerated (status KNOWN_LIMITATION) while the known limitation stays honestly disclosed. */
  tolerate?: OutcomeClass[];
  pendingRelease?: PendingReleaseId;
  /** Outcome classes tolerated in `prep` mode only (status PENDING_RELEASE); blocking in `final` mode. */
  tolerateUntilRelease?: OutcomeClass[];
  /** Disclosure text that must be present for the known limitation to count as honestly disclosed. */
  requiredDisclosure?: RegExp;
  notes?: string;
};

const A = 'SOURCE_BACKED_RESULT', B = 'DETERMINISTIC_CLARIFICATION', C = 'HONEST_UNSUPPORTED_WITH_NEXT_ACTION', D = 'SOURCE_UNAVAILABLE_WITH_FAIL_CLOSED_NEXT_ACTION';
const CONTRACTOR_PENDING = { pendingRelease: 'CONTRACTOR_COLD_PATH_STABILIZATION' as const, tolerateUntilRelease: ['TECHNICAL_TIMEOUT' as const] };
/** Pre-execution wording ("state-specific sources … not a CMS directory") or executed wording ("not supported by the accepted source … no provider cohort was substituted"). */
const CMS_GAP_DISCLOSURE = /state-specific sources|not (?:a |part of the )?CMS|not supported by the accepted source|no (?:nursing-home|provider)[^.]*substituted/i;

export const QUERY_PACK: readonly PackEntry[] = [
  // LENDER
  { id: 'LEN-01', hub: 'lender', kind: 'identity', query: 'is rocket mortgage legit', expectedVertical: 'lender', expectMatch: true, expectedEntityContains: 'rocket mortgage', accept: [A] },
  { id: 'LEN-02', hub: 'lender', kind: 'cohort_state', query: 'banks that do helocs in ohio', expectedVertical: 'lender', expectedGeography: { stateCode: 'OH' }, accept: [B, C], notes: 'HELOC is not an HMDA cohort filter; Ask asks for a lender name and hands off to LenderTrustHub + NMLS Consumer Access. Geography is recorded on the plan, not executed.' },
  { id: 'LEN-03', hub: 'lender', kind: 'product_local', query: 'va loan lenders near fort bragg nc', expectedVertical: 'lender', expectedGeography: { stateCode: 'NC' }, expectedProduct: { loanType: 'VA' }, accept: [A, B], notes: 'Fort Bragg resolves to Fayetteville, NC; HMDA is state/county-grain so execution auto-broadens to North Carolina with an explicit "You asked / Research executed" disclosure and a consent action.' },
  // INSURANCE
  { id: 'INS-01', hub: 'insurance', kind: 'cohort_local', query: 'insurance agent in miami', expectedVertical: 'insurance', expectedGeography: { stateCode: 'FL', county: 'Miami-Dade' }, expectedProduct: { insuranceEntityClass: 'producer' }, accept: [C, D], notes: 'Producer + city: the OFFICE_LOCATION directory only exists for the agency class, so this is an honest local-scope-not-executed state with a "Research Florida instead" consent action.' },
  { id: 'INS-02', hub: 'insurance', kind: 'cohort_local', query: 'insurance agency in broward county', expectedVertical: 'insurance', expectedGeography: { stateCode: 'FL', county: 'Broward' }, expectedProduct: { insuranceEntityClass: 'agency' }, accept: [A, C, D], notes: 'POST-R1-INS-LOCAL-001 fix target. With the OFFICE_LOCATION backend up: RECORDED_COUNTY directory rows. With it down: fail-closed local-directory-unavailable state. Never the unscoped statewide population.' },
  { id: 'INS-03', hub: 'insurance', kind: 'product_local', query: 'medicare supplement agent in ohio', expectedVertical: 'insurance', expectedGeography: { stateCode: 'OH' }, accept: [B, C], notes: 'Must stay Insurance-only ("Medicare" alone must never add SeniorTrustHub).' },
  { id: 'INS-04', hub: 'insurance', kind: 'multi_hub', query: 'is state farm licensed in texas', expectedVertical: ['insurance'], expectedGeography: { stateCode: 'TX' }, accept: [B], notes: 'Brand name with no vocabulary word: deterministic multi-hub picker (POST-R1-ASK-MULTIHUB-001). Choosing InsuranceTrustHub must not invalidate the session.' },
  // CONTRACTOR
  { id: 'CON-01', hub: 'contractor', kind: 'cohort_local', query: 'general contractor in miami', expectedVertical: 'contractor', expectedGeography: { stateCode: 'FL', county: 'Miami-Dade' }, accept: [A], ...CONTRACTOR_PENDING },
  { id: 'CON-02', hub: 'contractor', kind: 'cohort_local', query: 'roofers in broward', expectedVertical: 'contractor', expectedGeography: { stateCode: 'FL', county: 'Broward' }, accept: [A], ...CONTRACTOR_PENDING },
  { id: 'CON-03', hub: 'contractor', kind: 'cohort_local', query: 'plumber in miami', expectedVertical: 'contractor', expectedGeography: { stateCode: 'FL', county: 'Miami-Dade' }, accept: [A], ...CONTRACTOR_PENDING },
  { id: 'CON-04', hub: 'contractor', kind: 'identifier', query: 'verify contractor license CBC015082', expectedVertical: 'contractor', expectedIdentifierType: 'state_contractor_license', expectMatch: true, accept: [A], ...CONTRACTOR_PENDING, knownLimitation: 'CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP' },
  { id: 'CON-05', hub: 'contractor', kind: 'product_local', query: 'licensed electrician in boca raton', expectedVertical: 'contractor', expectedGeography: { stateCode: 'FL', city: 'Boca Raton' }, expectedProduct: { trade: 'electrical' }, accept: [A, B, C], knownLimitation: 'FL_ELECTRICAL_SOURCE_GAP', requiredDisclosure: /electrical-specific (?:florida )?(?:credential )?data is not available|unsupported_florida_electrical_source|does not include the separately regulated electrical credentials|no florida electrical source/i, ...CONTRACTOR_PENDING, notes: 'Two live variants, both honest: (i) clearly-labeled broader general/building rows when the fallback fetch completes, (ii) UNSUPPORTED_TRADE_CAPABILITY with supported trade choices when it does not.' },
  // SENIOR
  { id: 'SEN-01', hub: 'senior', kind: 'identity', query: 'is abbey delray south medicare certified', expectedVertical: 'senior', expectedEntityContains: 'abbey delray south', accept: [A, B], notes: 'Entity carried (never the whole sentence); care-class clarification precedes execution.' },
  { id: 'SEN-02', hub: 'senior', kind: 'cohort_local', query: 'hospice care for my mom in tampa', expectedVertical: 'senior', expectedGeography: { stateCode: 'FL' }, expectedProduct: { providerClass: 'hospice' }, accept: [A] },
  { id: 'SEN-03', hub: 'senior', kind: 'unsupported_source', query: 'memory care in orlando', expectedVertical: 'senior', expectedGeography: { stateCode: 'FL' }, expectedProduct: { careSetting: 'memory_care' }, accept: [B, C], knownLimitation: 'CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP', requiredDisclosure: CMS_GAP_DISCLOSURE, notes: 'The requested care setting is recorded on the plan; providerClass stays unset because no CMS class is executable. The client sends EXECUTE for a care task, so the executed wording ("not supported by the accepted source / no provider cohort was substituted") is what the browser shows.' },
  { id: 'SEN-04', hub: 'senior', kind: 'unsupported_source', query: 'assisted living facilities in new jersey', expectedVertical: 'senior', expectedGeography: { stateCode: 'NJ' }, expectedProduct: { careSetting: 'assisted_living' }, accept: [B, C], knownLimitation: 'CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP', requiredDisclosure: CMS_GAP_DISCLOSURE },
  { id: 'SEN-05', hub: 'senior', kind: 'cohort_local', query: 'home health agencies in miami dade county', expectedVertical: 'senior', expectedGeography: { stateCode: 'FL', county: 'Miami-Dade' }, expectedProduct: { providerClass: 'home_health' }, accept: [C, B], knownLimitation: 'HOME_HEALTH_COUNTY_SERVICE_AREA', requiredDisclosure: /not (?:patient )?service (?:availability|area)|office geography is not/i },
  // MOVE
  { id: 'MOV-01', hub: 'move', kind: 'identity', query: 'Senior Moving Services LLC', expectedVertical: 'move', expectMatch: true, accept: [A], notes: 'Resolves through the network name-candidate search (exact source name in MoveTrustHub); the SENIOR_AND_MOVE journey reading never pre-empts a supplied business name.' },
  { id: 'MOV-02', hub: 'move', kind: 'cohort_local', query: 'movers in broward county', expectedVertical: 'move', expectedGeography: { stateCode: 'FL' }, accept: [A, B], notes: 'Recorded headquarters is state-grain; county request auto-broadens to Florida with explicit "You asked / Research executed" disclosure.' },
  { id: 'MOV-03', hub: 'move', kind: 'identifier', query: 'USDOT 3244649', expectedVertical: 'move', expectedIdentifierType: 'usdot', expectMatch: true, accept: [A] },
  // INVESTOR
  { id: 'INV-01', hub: 'investor', kind: 'identity', query: 'Fisher Investments', expectedVertical: 'investor', expectMatch: true, accept: [A], notes: 'Resolves through the network name-candidate search (NORMALIZED_NAME in InvestorTrustHub).' },
  { id: 'INV-02', hub: 'investor', kind: 'identifier', query: 'CRD 105958', expectedVertical: 'investor', expectedIdentifierType: 'CRD', expectMatch: true, accept: [A] },
  { id: 'INV-03', hub: 'investor', kind: 'cohort_state', query: 'investment advisers in california', expectedVertical: 'investor', expectedGeography: { stateCode: 'CA' }, accept: [A] },
  // MULTI-HUB / NETWORK
  { id: 'NET-01', hub: 'network', kind: 'ambiguous_name', query: 'AVANTE', accept: [A, B], knownLimitation: 'AVANTE_SIX_CHARACTER_AMBIGUITY', limitationHub: 'senior', requiredDisclosure: /six-character/i, notes: 'Network name-candidate search; Senior must disclose the six-character CCN ambiguity rather than guess.' },
  { id: 'NET-02', hub: 'network', kind: 'multi_hub', query: 'electrician mortgage lender New Jersey', expectedVertical: ['lender', 'contractor'], expectedGeography: { stateCode: 'NJ' }, accept: [B], notes: 'Intentionally spans two specialists; deterministic hub picker.' },
  { id: 'NET-03', hub: 'network', kind: 'no_result', query: 'NPN 00000001', expectedVertical: 'insurance', expectedIdentifierType: 'NPN', expectMatch: false, accept: [A, C], notes: 'Well-formed identifier with no record: honest NO_CONFIDENT_MATCH with specialist + official-source next actions. Never fabricated.' },
  { id: 'NET-04', hub: 'network', kind: 'unsupported_source', query: 'restaurant health inspections in miami', accept: [B, C], notes: 'No TrustHub vertical owns this source. Ask must not fabricate; currently a deterministic hub picker.' },
  { id: 'NET-05', hub: 'network', kind: 'identity', query: 'brightway insurance jacksonville', expectedVertical: 'insurance', expectMatch: false, accept: [A, C], knownLimitation: 'INSURANCE_JACKSONVILLE_CROSSWALK_GAP', limitationHub: 'insurance', notes: 'Entity + unrecognized city is searched whole as a name; an honest network miss is the frozen limitation, not a failure.' },
];

/**
 * Non-gating observations: recorded on every run for Founder triage, never asserted. These are
 * pre-existing behaviors noticed while freezing the pack that are NOT part of any released ticket.
 */
export const OBSERVATION_QUERIES: readonly PackEntry[] = [
  { id: 'OBS-01', hub: 'network', kind: 'multi_hub', query: 'I need a mover and a mortgage lender in New Jersey', accept: [B], notes: 'MULTI_HUB_JOURNEY plan whose journey planner returns null; guided session lands in CLARIFY with no choices and no next actions.' },
];

/** Hosts a destination / next action / candidate action may point at. Anything else is BROKEN_HANDOFF. */
export const DESTINATION_HOST_ALLOWLIST = new Set([
  'www.movetrusthub.com', 'www.lendertrusthub.com', 'www.insurancetrusthub.com', 'www.contractortrusthub.com', 'www.seniortrusthub.com', 'www.investortrusthub.com',
  'www.fmcsa.dot.gov', 'www.nmlsconsumeraccess.org', 'www.medicare.gov', 'adviserinfo.sec.gov', 'content.naic.org',
]);

/**
 * Section 4 -- source-grain rules. When a hub returns rows (or name candidates), its disclosure text
 * must carry the hub's grain rule verbatim-in-spirit. Structural: presence of the disclosure, not counts.
 */
export const SOURCE_GRAIN_RULES: Record<SpecialistHubId, Array<{ rule: string; pattern: RegExp }>> = {
  lender: [{ rule: 'HMDA property geography != lender branch/service area', pattern: /property geography is not (?:lender )?headquarters, branch location/i }],
  insurance: [{ rule: 'credential geography != service territory; state license jurisdiction != office location; recorded address != availability', pattern: /credential jurisdiction (?:does not establish|is not) office location|not (?:a confirmed )?service (?:territory|area)/i }],
  contractor: [{ rule: 'recorded credential/address geography != service territory or availability', pattern: /not service territory(?: or current availability)?/i }],
  senior: [
    { rule: 'CMS recorded location != patient service area', pattern: /not (?:patient )?service (?:area|availability)/i },
    { rule: 'missing evidence != clean history', pattern: /missing source evidence is not zero, clean/i },
  ],
  move: [{ rule: 'recorded headquarters != service territory', pattern: /recorded headquarters(?: --)? (?:is )?not service territory/i }],
  investor: [{ rule: 'principal office != client geography', pattern: /principal[- ]office(?: geography)?(?: --)? (?:is )?not client geography/i }],
};

/**
 * Affirmative claims no Ask surface may ever make. A `code` promotes the hit to that unacceptable
 * outcome class; a rule without a code is reported as a source-grain violation.
 */
export const FORBIDDEN_CLAIMS: Array<{ code?: UnacceptableOutcomeClass; rule: string; pattern: RegExp }> = [
  { code: 'SERVICE_TERRITORY_INFERENCE', rule: 'recorded location != service territory', pattern: /\b(?:serves|serving|services)\s+(?:the\s+)?(?:entire|all|whole|every|customers|clients)\b(?![^.]*\bnot\b)/i },
  { code: 'SERVICE_TERRITORY_INFERENCE', rule: 'recorded location != service territory', pattern: /\bservice (?:area|territory) (?:confirmed|verified|established)\b/i },
  { rule: 'missing evidence != clean history', pattern: /\b(?:clean (?:record|history)|no complaints on file|no violations on record)\b/i },
];
