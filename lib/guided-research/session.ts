import {initialCareRatingFilters} from '../network/care-task.ts';
import { randomUUID } from 'node:crypto';
import {careTask,planCareResearch,type CareSetting} from '../network/care-task.ts';
import { parseNetworkAsk } from '../network/ask-parse.ts';
import { planAskResearch, planRequiresImmediateClarification, validateAskResearchPlan, type AskResearchPlan } from '../network/research-planner.ts';
import { resolveResearchScope } from '../network/research-scope.ts';
import { GUIDED_PHASES, GUIDED_PILOT_HUBS, GUIDED_RESULT_STATES, GUIDED_SESSION_TTL_MS, GUIDED_SESSION_VERSION, type GuidedChoice, type GuidedGeography, type GuidedResearchSession, type GuidedSessionSnapshot } from './contract.ts';
import { NETWORK_PUBLIC_NAMES } from '../network/registry.ts';
import { IDENTIFIER_FILLER_SOURCE } from '../network/identifiers.ts';

/**
 * TH-SEARCH-R1-018 BLOCKER-IDENTIFIER-FILLER-WORD-01.
 *
 * Recognizes a regulatory identifier label optionally followed by a natural filler word/phrase
 * ("code", "company code", "number", "no.", "#") before the actual value, so phrasings like
 * "NAIC code 10064" or "NPN number 20000635" extract the real value instead of the filler word
 * itself. Centralized here (rather than per-hub) since every guided-session identifier capture
 * site shares this same label+filler+value shape. `anchored` matches a direct single-value input
 * (e.g. a dedicated "provide the identifier" follow-up field) rather than free natural-language
 * text embedded in a longer sentence.
 */
export type LabeledIdentifierMatch = { type: string; value: string };
// TH-ARCH-P0-001: maps research-planner.ts's lowercase identifier family ids (from
// identifiers.ts's IDENTIFIER_FAMILIES) to the uppercase display codes this session layer has
// always exposed on GuidedResearchSession.identifier. Scoped to the financial families the
// investor/insurance/lender fast paths below actually consult.
const FINANCIAL_IDENTIFIER_LABELS = { crd: 'CRD', npn: 'NPN', naic_company_code: 'NAIC', nmls: 'NMLS', lei: 'LEI' } as const;
export function parseLabeledIdentifier(text: string, digitLabels: readonly string[], options: { anchored?: boolean; leiSupported?: boolean } = {}): LabeledIdentifierMatch | null {
  const { anchored = false, leiSupported = false } = options;
  const start = anchored ? '^' : '\\b';
  const end = anchored ? '$' : '\\b';
  const digitMatch = text.match(new RegExp(`${start}(${digitLabels.join('|')})\\b${IDENTIFIER_FILLER_SOURCE}(\\d{3,12})${end}`, 'i'));
  if (digitMatch) {
    const rawType = digitMatch[1]!.toUpperCase();
    return { type: rawType === 'DOT' ? 'USDOT' : rawType, value: digitMatch[2]! };
  }
  if (leiSupported) {
    const leiMatch = text.match(new RegExp(`${start}LEI\\b${IDENTIFIER_FILLER_SOURCE}([A-Z0-9]{18,22})${end}`, 'i'));
    if (leiMatch) return { type: 'LEI', value: leiMatch[1]!.toUpperCase() };
  }
  return null;
}

const CARE_CHOICES: GuidedChoice[] = [
  { id: 'nursing-home', label: 'Nursing home / skilled nursing', action: 'SELECT_CHOICE', value: 'nursing_home', description: 'Facility-based skilled nursing and long-term care records.' },
  { id: 'home-health', label: 'Home health agencies', action: 'SELECT_CHOICE', value: 'home_health', description: 'CMS home-health agency records, not every form of personal care. Office location is not service area.' },
  { id: 'assisted-living', label: 'Assisted living', action: 'SELECT_CHOICE', value: 'assisted_living', description: 'State-specific research; not a CMS nursing-home directory.' },
  { id: 'hospice', label: 'Hospice care', action: 'SELECT_CHOICE', value: 'hospice', description: 'Hospice provider records; office geography is not service availability.' },
  { id: 'care-explain', label: "I'm not sure — explain the differences", action: 'SELECT_CHOICE', value: 'explain_care' },
];
const TRADE_CHOICES: GuidedChoice[] = [
  { id:'trade-roofing',label:'Roofing',action:'SELECT_CHOICE',value:'roofing' },
  { id:'trade-hvac',label:'Air conditioning / HVAC',action:'SELECT_CHOICE',value:'hvac' },
  { id:'trade-plumbing',label:'Plumbing',action:'SELECT_CHOICE',value:'plumbing' },
  { id:'trade-electrical',label:'Electrical',action:'SELECT_CHOICE',value:'electrical',description:'Electrical-contractor source coverage varies by jurisdiction.' },
  { id:'trade-general',label:'General / building construction',action:'SELECT_CHOICE',value:'general' },
  { id:'trade-pool-spa',label:'Pool / spa',action:'SELECT_CHOICE',value:'pool_spa' },
  { id:'trade-mechanical',label:'Mechanical',action:'SELECT_CHOICE',value:'mechanical' },
  { id:'trade-other',label:"Other / I’m not sure",action:'SELECT_CHOICE',value:'other_trade',description:'Describe the project briefly, then confirm a supported source category before research runs.' },
];
const MOVE_CHOICES: GuidedChoice[] = [
  { id: 'move-household', label: 'Household belongings', action: 'SELECT_CHOICE', value: 'mover' },
  { id: 'move-auto', label: 'A car or vehicle', action: 'SELECT_CHOICE', value: 'auto_transport' },
  { id: 'move-company', label: 'I have a specific company to research', action: 'SELECT_CHOICE', value: 'identity_name' },
  { id: 'move-id', label: 'I have a USDOT or MC number', action: 'SELECT_CHOICE', value: 'identifier' },
];
const INVESTOR_CHOICES: GuidedChoice[] = [
  {id:'investor-firms',label:'Research investment adviser firms',action:'SELECT_CHOICE',value:'investor_mode:firm_cohort',description:'RIA and ERA firms remain separate source-native classes.'},
  {id:'investor-crd',label:'Research an exact CRD',action:'SELECT_CHOICE',value:'investor_mode:identifier'},
  {id:'investor-name',label:'Research a specific firm name',action:'SELECT_CHOICE',value:'investor_mode:identity_name'},
  {id:'investor-unsure',label:"I’m not sure",action:'SELECT_CHOICE',value:'investor_mode:explain',description:'Firm research does not publish individual investment-adviser representatives.'},
];
const INSURANCE_CHOICES: GuidedChoice[] = [
  {id:'insurance-agency',label:'Insurance agency',action:'SELECT_CHOICE',value:'insurance_class:agency'},
  {id:'insurance-insurer',label:'Insurance company / legal insurer',action:'SELECT_CHOICE',value:'insurance_class:legal_insurer'},
  {id:'insurance-producer',label:'Individual agent / producer',action:'SELECT_CHOICE',value:'insurance_class:producer',description:'Mass person publication is restricted.'},
  {id:'insurance-id',label:'I have an NPN or NAIC code',action:'SELECT_CHOICE',value:'insurance_mode:identifier'},
  {id:'insurance-unsure',label:"I’m not sure",action:'SELECT_CHOICE',value:'insurance_mode:explain',description:'Agency, producer, and legal insurer are different regulatory classes.'},
];
const LENDER_CHOICES: GuidedChoice[] = [
  {id:'lender-market',label:'Mortgage activity for properties in an area',action:'SELECT_CHOICE',value:'lender_mode:property_market',description:'HMDA property geography is not headquarters or service territory.'},
  {id:'lender-name',label:'A specific lender',action:'SELECT_CHOICE',value:'lender_mode:identity_name'},
  {id:'lender-id',label:'An NMLS or LEI',action:'SELECT_CHOICE',value:'lender_mode:identifier'},
  {id:'lender-complaints',label:'Complaint evidence about a known lender',action:'SELECT_CHOICE',value:'lender_mode:complaints'},
  {id:'lender-unsure',label:"I’m not sure",action:'SELECT_CHOICE',value:'lender_mode:explain',description:'Institutions, branches, and individual MLOs remain separate.'},
];

function snapshot(session: GuidedResearchSession): GuidedSessionSnapshot {
  const state = structuredClone(session) as GuidedResearchSession & Record<string, unknown>;
  for (const key of ['version','sessionId','originalQuestion','createdAt','updatedAt','history']) delete state[key];
  return state;
}

export function validateGuidedSession(value: unknown): GuidedResearchSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as GuidedResearchSession;
  if (row.version !== GUIDED_SESSION_VERSION || !row.sessionId || !row.originalQuestion || !row.researchPlan || !row.executionScope) return null;
  if (!GUIDED_PHASES.includes(row.phase) || (row.hub && !GUIDED_PILOT_HUBS.includes(row.hub))) return null;
  if (row.lastExecution && (row.lastExecution.source !== 'specialist' || !GUIDED_RESULT_STATES.includes(row.lastExecution.resultState) || row.lastExecution.resultBearing !== true || typeof row.lastExecution.choicesBearing !== 'boolean' || !Number.isFinite(Date.parse(row.lastExecution.executedAt)) || (row.lastExecution.errorCode !== undefined && typeof row.lastExecution.errorCode !== 'string'))) return null;
  if (!Array.isArray(row.history) || !Array.isArray(row.nextActions) || !row.selectedFilters || typeof row.selectedFilters !== 'object') return null;
  const updated = Date.parse(row.updatedAt);
  if (!Number.isFinite(updated) || Date.now() - updated > GUIDED_SESSION_TTL_MS) return null;
  return row;
}

export function parseGuidedGeography(raw: string): GuidedGeography | null {
  const value = raw.trim().replace(/[.,]+$/g, '');
  if (!value) return null;
  // Summit is a city in Union County. Never accept the contradictory
  // "Summit County, New Jersey" combination as a source geography.
  if (/^summit\s+county(?:\s*,?\s*(?:new\s+jersey|nj))?$/i.test(value)) return {
    type:'county',value:'Summit County, New Jersey',county:'Summit County',stateCode:'NJ',stateName:'New Jersey',
    meaning:'Submitted geography requires source validation; New Jersey has no Summit County.',
  };
  if (/^summit(?:\s*,?\s*(?:new\s+jersey|nj))$/i.test(value)) return {
    type: 'city', value: 'Summit, New Jersey', city: 'Summit', county: 'Union',
    stateCode: 'NJ', stateName: 'New Jersey',
    meaning: 'Recorded Summit city geography in Union County, New Jersey; not service territory.',
  };
  if (/^\d{5}$/.test(value)) return { type: 'zip', value, meaning: 'Recorded ZIP in the specialist source; not service availability.' };
  const parsed = parseNetworkAsk(`providers in ${value}`);
  if (parsed.geography?.countyName) return { type: 'county', value: parsed.geography.countyName.replace(/ County$/i, ''), county: parsed.geography.countyName.replace(/ County$/i, ''), stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded county geography; not service territory.' };
  if (parsed.geography?.city) return { type: 'city', value: parsed.geography.city, city: parsed.geography.city, stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded city/address geography; not service territory.' };
  if (parsed.geography?.stateCode) return { type: 'state', value: parsed.geography.stateCode, stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded state geography; not service territory.' };
  if (/broward/i.test(value)) return { type: 'county', value: 'Broward', county: 'Broward', stateCode: 'FL', stateName: 'Florida', meaning: 'Recorded Broward County geography; not service territory.' };
  if (/palm\s*beach/i.test(value)) return { type: 'county', value: 'Palm Beach', county: 'Palm Beach', stateCode: 'FL', stateName: 'Florida', meaning: 'Recorded Palm Beach County geography; not service territory.' };
  return { type: 'city', value, city: value, meaning: 'Recorded city/address geography where supported; not service territory.' };
}

function geographyFromParsed(parsed: ReturnType<typeof parseNetworkAsk>): GuidedGeography | undefined {
  const geography = parsed.geography;
  if (!geography) return undefined;
  const stateSuffix = geography.stateName ? `, ${geography.stateName}` : '';
  if (geography.city) return parseGuidedGeography(`${geography.city}${stateSuffix}`) ?? undefined;
  if (geography.countyName) return parseGuidedGeography(`${geography.countyName}${stateSuffix}`) ?? undefined;
  return parseGuidedGeography(geography.stateName ?? geography.stateCode ?? '') ?? undefined;
}

function newJerseyTrade(question:string,stateCode?:string):string|undefined {
  if(stateCode!=='NJ')return undefined;
  const choices:Array<[RegExp,string]>=[
    [/\bhome\s+improvement(?:\s+contractors?)?\b/i,'home_improvement'],[/\b(?:electricians?|electrical(?:\s+contractors?)?)\b/i,'electrical'],
    [/\b(?:plumbers?|plumbing(?:\s+contractors?)?)\b/i,'plumbing'],[/\b(?:hvac|air\s+conditioning)(?:\s+contractors?)?\b/i,'hvac'],
    [/\bmechanical(?:\s+contractors?)?\b/i,'mechanical'],[/\balarm(?:\s+contractors?)?\b/i,'alarm'],[/\btelecom(?:munications?)?(?:\s+contractors?)?\b/i,'telecom'],
    [/\blocksmiths?\b/i,'locksmith'],[/\bhearth(?:\s+specialists?)?\b/i,'hearth'],[/\bgeneral\s+contractors?\b/i,'general'],
  ];
  return choices.find(([pattern])=>pattern.test(question))?.[1];
}

function base(question: string, plan: AskResearchPlan): GuidedResearchSession {
  const now = new Date().toISOString();
  return {
    version: GUIDED_SESSION_VERSION, sessionId: randomUUID(), originalQuestion: question.trim(),
    researchPlan: plan, executionScope:resolveResearchScope(plan), phase: 'UNDERSTAND', queryType: plan.legacyQueryType, selectedFilters: {},
    requestedEvidence: [], missingFields: [], availableChoices: [], availableRefinements: [], nextActions: [],
    createdAt: now, updatedAt: now, history: [],
  };
}

function createUnscopedGuidedSession(question: string): GuidedResearchSession | null {
  const q = question.trim();
  if (!q) return null;
  const parsed = parseNetworkAsk(q);
  const plan = validateAskResearchPlan(planAskResearch(q));
  const session = base(q, plan);
  if(plan.reasonCodes.includes('CARE_TASK')){
    session.selectedFilters=initialCareRatingFilters(q,plan.careSetting);
    const next=refreshCareSession({...session,hub:'senior'},plan.careSetting);
    return next;
  }
  const financialGeography=geographyFromParsed(parsed);
  // TH-ARCH-P0-001: consume the canonical planner's identifier extraction (ask-parse.ts's
  // matchIdentifier, now filler-word-hardened -- see IDENTIFIER_FILLER_SOURCE) instead of
  // independently re-parsing the raw query with a second implementation. Scoped to the same
  // financial identifier families the prior duplicate parser covered (CRD/NPN/NAIC/NMLS/LEI);
  // USDOT/MC/CCN/state-license identifiers are handled by the generic hub-resolution path below,
  // which already reads parsed.identifier directly.
  if (plan.identifier && plan.identifier.type in FINANCIAL_IDENTIFIER_LABELS) {
    session.identifier = { type: FINANCIAL_IDENTIFIER_LABELS[plan.identifier.type as keyof typeof FINANCIAL_IDENTIFIER_LABELS], value: plan.identifier.value };
  }

  // TH-DISCOVERY-002: a live-rate-shopping request ("lowest mortgage rates today") has no entity
  // to look up and no geography to browse -- it's asking for real-time pricing this network does
  // not have. Left to the generic missing-identity clarification below, it silently got treated
  // like any other "provide a name or ID" case without ever acknowledging rates at all. Scoped
  // narrowly (no identifier, no entity name, no geography) so a geography-scoped rate mention
  // ("mortgage rates in Florida") still reaches real property-market lender results instead of
  // being intercepted here.
  if (!plan.identifier && !plan.entityName && !plan.requestedGeography && /\b(?:mortgage|lender|home\s+loan)s?\b/i.test(q) && /\brates?\b/i.test(q)) {
    return { ...session, hub: 'lender', phase: 'CLARIFY', missingFields: [], availableChoices: [], nextAction: 'TrustHub does not have live, real-time mortgage rate pricing. Research a specific lender’s public HMDA activity and reported loan types, or provide an NMLS ID/LEI or lender name for exact identity research instead.' };
  }

  if (planRequiresImmediateClarification(plan)) {
    session.hub = plan.primaryHub as GuidedResearchSession['hub'];
    session.entityClass = plan.entityClass?.id;
    session.requestedEvidence = plan.requestedEvidence;
    session.missingFields = [...plan.missingSlots];
    if (plan.normalizedGeography) session.geography = geographyFromParsed(parsed);
    return { ...session, phase: 'CLARIFY', nextAction: plan.clarificationReason ?? 'Clarify the research request before specialist execution.' };
  }

  // TH-ARCH-P0-001: the canonical planner (research-planner.ts) already decided how many
  // specialist verticals this question spans, in plan.candidateHubs. None of the hub-specific
  // fast paths below may claim a query the planner recognized as multi-hub -- that is exactly
  // the first-match-wins semantic-competition failure this ticket closes. This backstops (does
  // not replace) the planner's own MULTI_HUB_JOURNEY detection: it fires whenever candidateHubs
  // has 2+ entries, regardless of which structural pattern (explicit conjunction, verb phrasing,
  // or none) the planner used to get there.
  if (plan.candidateHubs.length > 1) {
    return {
      ...session,
      hub: undefined,
      entityClass: plan.entityClass?.id,
      requestedEvidence: plan.requestedEvidence,
      phase: 'CLARIFY',
      missingFields: ['hub'],
      availableChoices: plan.candidateHubs.map((hubId) => ({
        id: `hub-${hubId}`,
        label: NETWORK_PUBLIC_NAMES[hubId],
        action: 'SELECT_CHOICE' as const,
        value: `hub:${hubId}`,
      })),
      nextAction: 'This question touches more than one specialist area. Which would you like to research first?',
    };
  }

  const investorIntent=/\b(?:investment\s+advis(?:er|or)|advis(?:er|or)s?|advisory\s+firm|\bRIA\b|\bRIAs\b|\bERA\b|\bERAs\b|\bCRD\b|Form\s+ADV|IARD)\b/i.test(q);
  if(investorIntent){
    session.hub='investor';session.geography=financialGeography;
    if(/^i\s+need\s+an?\s+investment\s+advis(?:er|or)\s*[?.!]*$/i.test(q))return {...session,phase:'CLARIFY',missingFields:['investorResearchMode'],availableChoices:INVESTOR_CHOICES,nextAction:'What would you like to research?'};
    session.investorResearchMode=session.identifier?'identifier':/\bnamed\s+(.+)$/i.test(q)?'identity_name':'firm_cohort';
    session.identityName=q.match(/\bnamed\s+(.+)$/i)?.[1]?.trim();
    session.investorFirmClass=/\bindividual\b|representatives?/i.test(q)?'individual_representative':/\bERAs?\b|exempt\s+reporting/i.test(q)?'era':/\bRIAs?\b|registered\s+investment/i.test(q)?'ria':'ria_and_era';
    session.entityClass=session.investorFirmClass;
    if(/\b(?:1|one)\s*billion\b/i.test(q))session.minimumRaum=1_000_000_000;
    if(/\b10\s*billion\b/i.test(q))session.maximumRaum=10_000_000_000;
    if(/\b2\s*billion\b/i.test(q))session.minimumRaum=2_000_000_000;
    if(/percentage\s+of\s+assets/i.test(q))session.compensationMethod='percentage_of_assets';
    session.requestedEvidence=/highest-performing|\bperformance\b/i.test(q)?['PERFORMANCE']:/\bsafest\b/i.test(q)?['SAFETY_RANKING']:[];
    return {...session,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
  }

  // TH-DISCOVERY-002: a well-known carrier brand name alone ("State Farm agent near me") matched
  // no insurance-hub signal at all and returned a raw 422 "not_guided_query" error -- there was no
  // path into the insurance flow to even honestly disclose that carrier-appointment evidence isn't
  // established (ticket section 24). Mirrors the existing Rocket Mortgage/Newrez brand-name
  // precedent already in lenderIntent below; bounded to a short list of major P&C/health carriers
  // used only for hub routing, not a new dataset.
  const insuranceIntent=/\b(?:insurance|insurers?|\bNPN\b|\bNAIC\b|State\s+Farm|Allstate|GEICO|Progressive|Nationwide|Farmers|USAA|Liberty\s+Mutual|Travelers)\b/i.test(q);
  if(insuranceIntent){
    session.hub='insurance';session.geography=financialGeography;
    if(/^i\s+need\s+help\s+with\s+insurance\s*[?.!]*$/i.test(q)||/\binsurance\s+provider\b/i.test(q)||/insurance\s+complaints\s+against\s+a\s+company/i.test(q)||/insurance\s+professional\s+near\s+me/i.test(q))return {...session,phase:'CLARIFY',missingFields:['insuranceEntityClass'],availableChoices:INSURANCE_CHOICES,nextAction:'What kind of insurance entity do you want to research?'};
    // TH-SEARCH-R1-018 BLOCKER-INSURANCE-01: a specific, defensible insurance entity name found
    // by the research planner is the authoritative identity candidate (same pattern as Move's
    // R1-016 fix) -- do not fall back to an unscoped cohort just because this hand-rolled block
    // never independently rediscovers a name.
    if(!session.identifier&&plan.entityName){
      session.identityName=plan.entityName;
      session.insuranceResearchMode='identity_name';
    } else {
      session.insuranceResearchMode=session.identifier?'identifier':'cohort';
    }
    // TH-DISCOVERY-002: "insurance company" is consumer-ambiguous (ticket section 15) -- it may
    // mean a local agency or the underwriting carrier. A locally-scoped request (city/ZIP) almost
    // always means "somewhere I can call/visit", which this data model represents as an agency,
    // not a legal_insurer -- confirmed live that legal_insurer cohorts are separately unsupported
    // regardless of geography grain ("legal insurers are limited to the accepted Wave-1 cohort"),
    // so defaulting to legal_insurer here was choosing the class that can never execute. The
    // unambiguous "legal insurer(s)" phrase always means legal_insurer regardless of geography.
    const explicitLegalInsurer=/\blegal\s+insurers?\b/i.test(q);
    const localInsuranceGeography=financialGeography?.type==='city'||financialGeography?.type==='zip';
    const ambiguousInsuranceCompany=/\b(?:insurance\s+compan(?:y|ies)|insurers?)\b/i.test(q)&&!explicitLegalInsurer;
    session.insuranceEntityClass=/\b(?:agents?|producers?|professional)\b/i.test(q)?'producer':(ambiguousInsuranceCompany&&localInsuranceGeography)?'agency':(explicitLegalInsurer||ambiguousInsuranceCompany)?'legal_insurer':'agency';
    session.entityClass=session.insuranceEntityClass;
    // TH-DISCOVERY-002: "homeowners insurance agencies in Florida" silently dropped "homeowners"
    // and returned all 56,939 Florida agency records with no acknowledgment the product word was
    // ignored -- confirmed live that InsuranceTrustHub's line-of-authority data does not exist at
    // agency grain (an agency-scoped LOA filter returns a genuine, valid ZERO_MATCHING_ROWS, not
    // an error), matching the existing 'life' handling below, just never generalized past that one
    // word. Recognize the same product/LOA vocabulary InsuranceTrustHub's own detectLoas()
    // recognizes so the specialist layer can disclose product specialization honestly instead of
    // silently ignoring it.
    const loaMatch=q.match(/\b(homeowners?|auto(?:mobile)?|health|casualty|personal\s+lines|variable\s+(?:life|annuit\w*))\s+insurance\b/i)?.[1]?.toLowerCase().replace(/\s+/g,' ') ?? (/\blife\s+insurance\b/i.test(q)?'life':undefined);
    if(loaMatch)session.insuranceLineOfAuthority=loaMatch;
    // TH-SEARCH-R1-018 BLOCKER-INSURANCE-01: specialist-execution/v2 does not support ZIP or
    // city-grain directory filtering (confirmed live -- it silently ignores the field and
    // returns the entire ~82k-agency population). A ZIP or bare city request must never fall
    // through to that unscoped cohort; hand off to InsuranceTrustHub's own certified ZIP/local
    // directory /ask flow instead, which does support it.
    if(!session.identityName&&!session.identifier){
      const zip=q.match(/\bzip\s*(?:code)?\s*#?\s*(\d{5})\b/i)?.[1];
      const zipGeography=zip?parseGuidedGeography(zip)??session.geography:session.geography;
      if(zip||session.geography?.type==='zip'||session.geography?.type==='city'){
        return {...session,geography:zipGeography,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute',insuranceResearchMode:'local_directory_handoff'};
      }
    }
    return {...session,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
  }

  const lenderIntent=/\b(?:mortgage|lenders?|\bNMLS\b|\bLEI\b|HMDA|FHA|VA|USDA|originations?|applications?|denials?|Rocket\s+Mortgage|Newrez)\b/i.test(q);
  if(lenderIntent){
    session.hub='lender';session.geography=financialGeography;
    if(/^i\s+need\s+a\s+mortgage\s+lender\s*[?.!]*$/i.test(q))return {...session,phase:'CLARIFY',missingFields:['lenderResearchMode'],availableChoices:LENDER_CHOICES,nextAction:'What would you like to research?'};
    const genericStateLenders=/^lenders?\s+in\s+(?:Texas|TX)\s*[?.!]*$/i.test(q);
    const complaintsAbout=q.match(/complaints?\s+about\s+(.+)$/i)?.[1]?.trim();
    // TH-DISCOVERY-002: mirror the insuranceIntent block's TH-SEARCH-R1-018 BLOCKER-INSURANCE-01
    // fix -- a specific, defensible entity name already found by the research planner
    // (plan.entityName) is the authoritative identity candidate. Without this, a named-company
    // query like "Rocket Mortgage" fell through to the unscoped property_market default below
    // (this block never independently rediscovered a name), sending a doomed market_cohort
    // request instead of the identity lookup the canonical plan (executionMode:'IDENTITY')
    // already resolved. "complaints about X" remains its own distinct mode, checked first.
    if(!session.identifier&&!complaintsAbout&&plan.entityName){
      session.identityName=plan.entityName;
      session.lenderResearchMode='identity_name';
    } else {
      session.lenderResearchMode=session.identifier?'identifier':complaintsAbout?'complaints':/brokers?\s+near\s+me/i.test(q)?'unsupported_person_branch':genericStateLenders?undefined:'property_market';
      session.identityName=complaintsAbout;
    }
    if(genericStateLenders&&session.lenderResearchMode===undefined)return {...session,lenderResearchMode:undefined,entityClass:undefined,phase:'CLARIFY',missingFields:['lenderResearchMode'],availableChoices:LENDER_CHOICES,nextAction:'What do you mean by lenders in this state?'};
    session.requestedEvidence=session.lenderResearchMode==='complaints'?['CFPB_COMPLAINTS']:[];
    session.hmdaAction=/\bdenials?\b/i.test(q)?'denial':/\bapplications?\b/i.test(q)?'application':'origination';
    session.loanType=/\bFHA\b/i.test(q)?'FHA':/\bVA\b/i.test(q)?'VA':/\bUSDA\b/i.test(q)?'USDA':/\bconventional\b/i.test(q)?'Conventional':undefined;
    session.entityClass=session.lenderResearchMode==='unsupported_person_branch'?'mlo_or_branch':'hmda_reporting_institution';
    return {...session,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
  }
  if (/\b(?:electrician|electrical\s+contractor)\b/i.test(q)) {
    const geography=geographyFromParsed(parsed);
    return { ...session,hub:'contractor',identityName:undefined,trade:'electrical',entityClass:'credential_record',geography,phase:geography?'EXECUTE':'COLLECT',missingFields:geography?[]:['geography'],nextAction:geography?'execute':'Where is the property?' };
  }
  const grandma = careTask(q)?.kind==='care' && /\b(?:grandma|grandmother|grandpa|grandfather|senior|elderly parent)\b/i.test(q) && /\b(?:home|care|facility|help|place)\b/i.test(q);
  if (grandma) return { ...session, hub: 'senior', phase: 'CLARIFY', missingFields: ['providerClass'], availableChoices: CARE_CHOICES, nextAction: 'What kind of care are you looking for?' };

  let parsedGeography=geographyFromParsed(parsed);
  if(parsedGeography?.stateCode==='NJ'&&parsedGeography.type==='state'){
    const local=q.match(/\bin\s+([A-Za-z][A-Za-z .'-]*?)\s*,?\s*(?:New\s+Jersey|NJ)\b/i)?.[1]?.trim();
    if(local)parsedGeography=/^summit$/i.test(local)?parseGuidedGeography('Summit, New Jersey')??parsedGeography:{type:'city',value:`${local}, New Jersey`,city:local,stateCode:'NJ',stateName:'New Jersey',meaning:'Requested New Jersey city geography pending specialist source validation; not service territory.'};
  }
  const njTrade=newJerseyTrade(q,parsedGeography?.stateCode);
  const parsedHub = parsed.suggestedHubs.length === 1 && GUIDED_PILOT_HUBS.includes(parsed.suggestedHubs[0] as never) ? parsed.suggestedHubs[0] as GuidedResearchSession['hub'] : undefined;
  const hub = plan.primaryHub ?? parsedHub ?? (njTrade?'contractor':undefined);
  if (!hub) return null;
  session.hub = hub;
  session.identifier = parsed.identifier ? { type: parsed.identifier.family.id, value: parsed.identifier.raw.replace(/^.*?([A-Z0-9-]+)$/i, '$1') } : undefined;
  // TH-SEARCH-R1-016: prefer research-planner's entity-name extraction (recognizes a
  // company name embedded alongside route/journey language, e.g. "Can JK Moving handle
  // my move from Virginia to Florida?") over the legacy whole-question fallback below,
  // which only ever matches when the query is nothing but a bare identity name.
  session.identityName = plan.entityName ?? (parsed.queryClassification.type === 'IDENTITY_NAME' ? q : undefined);
  if (parsed.geography) session.geography = parsedGeography;

  if (hub === 'senior') {
    session.providerClass = parsed.seniorProviderClass;
    session.entityClass = parsed.seniorProviderClass;
    if (session.identifier || session.providerClass && session.geography) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
    if (!session.providerClass) return { ...session, phase: 'CLARIFY', missingFields: ['providerClass'], availableChoices: CARE_CHOICES, nextAction: 'What kind of care are you looking for?' };
    return { ...session, phase: 'COLLECT', missingFields: ['geography'], nextAction: 'Where does she need care?' };
  }
  if (hub === 'contractor') {
    const trade = parsed.trade?.toLowerCase();
    // TH-DISCOVERY-RESET-001: ask-parse.ts's own `contractor`/`trade` gate (a hardcoded regex
    // requiring "contractor"/"roof(ing|er)"/"hvac"/"plumb"/"electrical"/... to even attempt trade
    // detection) never matches "electricians" ("electrician" is a different word from
    // "electrical", not a substring of it) -- so parsed.trade silently stayed undefined and the
    // request fell through to the generic "no trade requested" default-to-general fallback below,
    // incorrectly substituting general contractors for a specifically-requested trade. Match
    // directly against the same trade vocabulary specialists.ts's supportedTrades set already
    // recognizes, using the original question text as a second, independent source.
    const directTrade = ([
      [/\broof(?:ing|ers?)?\b/i, 'roofing'],
      [/\belectric(?:al|ians?)\b/i, 'electrical'],
      [/\bhvac\b|\bair[\s-]?condition/i, 'hvac'],
      [/\bplumb(?:ing|ers?)?\b/i, 'plumbing'],
      [/\bgeneral\s+contractors?\b|\bbuilding\s+contractors?\b/i, 'general'],
      [/\bpool\b|\bspa\b/i, 'pool_spa'],
      [/\bmechanical\b/i, 'mechanical'],
      [/\balarm\b/i, 'alarm'],
      [/\btelecom(?:munications?)?\b/i, 'telecom'],
      [/\blocksmiths?\b/i, 'locksmith'],
      [/\bhearth\b/i, 'hearth'],
      [/\bhome\s+improvement\b/i, 'home_improvement'],
    ] as const).find(([pattern]) => pattern.test(q))?.[1];
    session.trade = njTrade ?? (trade === 'general contractor' ? 'general' : trade) ?? directTrade;
    session.entityClass = 'credential_record';
    if(session.identifier)return {...session,identityName:undefined,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
    // TH-DISCOVERY-003: a bare company name (e.g. "ABC Roofing") used to be silently discarded
    // here (session.identityName=undefined, unconditionally) and fall through to the trade+
    // geography cohort-collection flow below with no explanation -- confirmed live that
    // ContractorTrustHub's specialist has no name-based identity lookup at all (queryType:'identity'
    // returns errorCode 'unsupported_field'; a name filter on the cohort query is silently ignored
    // by the live API). This is a genuine capability gap, not a wiring bug, so this does not invent
    // a name-search result -- it states the real limitation and the actual supported alternative
    // (exact license/credential number, or trade+location cohort browse) instead of quietly
    // pretending the name was never mentioned.
    if (plan.entityName) {
      return {...session,identityName:plan.entityName,phase:'CLARIFY',missingFields:[],availableChoices:[],nextAction:`ContractorTrustHub does not support company-name search -- only an exact license/credential number resolves precisely. Provide "${plan.entityName}"'s license number, or the property location and trade to browse the credential cohort instead.`};
    }
    session.identityName = undefined;
    const conflictingSummit = /\bsummit\s+county\b/i.test(q) && parsed.geography?.stateCode === 'NJ';
    if (conflictingSummit) return { ...session, geography:parseGuidedGeography('Summit County, New Jersey')??session.geography, phase:'EXECUTE',missingFields:[],nextAction:'execute' };
    if (session.trade && session.geography) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
    if (!session.trade && session.geography?.stateCode==='NJ') return { ...session, phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute' };
    // TH-DISCOVERY-RESET-001: RESULTS FIRST -- a bare "contractor(s)" request with real geography
    // must not block on a trade-choice menu before ever showing anyone. Live-confirmed the
    // specialist requires a trade (or identifier) to execute at all, and 'general' (building
    // contractor) returns real, substantial results (5,535 for Miami-Dade alone) -- default to it
    // and execute immediately. The trade menu remains available as a non-blocking narrowing
    // choice, not a gate.
    if (!session.trade && session.geography) return { ...session, trade: 'general', phase: 'EXECUTE', missingFields: [], availableChoices: TRADE_CHOICES, nextAction: 'execute' };
    if (!session.trade) return { ...session, phase: 'CLARIFY', missingFields: ['trade'], availableChoices: TRADE_CHOICES, nextAction: 'What kind of work do you need?' };
    return { ...session, phase: 'COLLECT', missingFields: ['geography'], nextAction: 'Where is the property?' };
  }
  session.regulatoryRole = parsed.moveRegulatoryRole === 'carrier' ? 'Carrier' : parsed.moveRegulatoryRole === 'broker' ? 'Broker' : parsed.moveRegulatoryRole === 'carrier_broker' ? 'Carrier/Broker' : undefined;
  if (/^(?:i\s+need\s+)?(?:some\s+)?movers?\s*[?.!]*$/i.test(q)) {
    return { ...session, identityName: undefined, moveMode: undefined, entityClass: undefined, phase: 'CLARIFY', missingFields: ['moveMode'], availableChoices: MOVE_CHOICES, nextAction: 'What are you moving?' };
  }
  session.moveMode = parsed.moveResearchCategory === 'auto_transport' ? 'auto_transport' : parsed.identifier ? 'identifier' : parsed.queryClassification.type === 'IDENTITY_NAME' ? 'identity_name' : parsed.queryClassification.type === 'COHORT' ? 'mover' : undefined;
  session.entityClass = session.moveMode;
  if (!plan.entityName && /\bserv(?:e|es|ing)|from .+ to|near me\b/i.test(q)) return { ...session, identityName: undefined, moveMode: session.moveMode ?? 'mover', phase: 'EXECUTE', nextAction: 'execute' };
  if (/\bship (?:my|a) (?:car|vehicle)|transport my (?:car|vehicle)\b/i.test(q)) return { ...session, identityName: undefined, moveMode: 'auto_transport', entityClass: 'auto_transport', phase: 'EXECUTE', nextAction: 'execute' };
  if (session.identifier || session.identityName || session.moveMode && (session.geography || session.moveMode === 'auto_transport')) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
  return { ...session, phase: 'CLARIFY', missingFields: ['moveMode'], availableChoices: MOVE_CHOICES, nextAction: 'What are you moving?' };
}

function guidedGeographyFromExecution(scope:GuidedResearchSession['executionScope']):GuidedGeography|undefined{
  const geo=scope.executionGeography;if(!geo||geo.kind==='national'||geo.kind==='region'||geo.kind==='route')return undefined;
  return {type:geo.kind,value:geo.kind==='state'?(geo.stateCode??geo.display):geo.kind==='county'?(geo.county??geo.display):geo.kind==='city'?(geo.city??geo.display):(geo.zip??geo.display),stateCode:geo.stateCode,stateName:geo.stateName,county:geo.county,city:geo.city,meaning:scope.executionGeographyMeaning};
}

export function createGuidedSession(question:string):GuidedResearchSession|null{
  const session=createUnscopedGuidedSession(question);if(!session)return null;
  if(session.researchPlan.reasonCodes.includes('CARE_TASK'))return session;
  // TH-ARCH-P0-001: the multi-hub guard above already produced its own CLARIFY (with a hub-choice
  // menu and an explanatory message) for a query the planner recognized as spanning multiple
  // verticals. session.hub is intentionally undefined at that point, which -- left to the scope-
  // narrowing logic below -- gets misread as "no hub decided yet, fall through" and overwrites the
  // hub-choice menu with an unrelated "local scope not executable" message. Return the multi-hub
  // clarification as-is instead.
  if(session.missingFields.includes('hub'))return session;
  if(!session.researchPlan.primaryHub&&session.hub)session.executionScope=resolveResearchScope({...session.researchPlan,primaryHub:session.hub,entityClass:session.entityClass?{id:session.entityClass,label:session.entityClass.replaceAll('_',' ')}:session.researchPlan.entityClass});
  const scope=session.executionScope;
  const executable=guidedGeographyFromExecution(scope);
  const unscopedIsMorePrecise=session.geography?.type==='city'&&scope.normalizedRequestedGeography?.kind==='state';
  const preserveUnsupportedTradeCity=session.hub==='contractor'&&session.trade==='electrical'&&session.geography?.type==='city';
  if(executable&&!unscopedIsMorePrecise&&!preserveUnsupportedTradeCity)session.geography=executable;
  // TH-SEARCH-R1-018 BLOCKER-INSURANCE-01: an insurance local-directory handoff (ZIP or bare
  // city, neither of which specialist-execution/v2 supports) already carries its own correct
  // UNSUPPORTED_CAPABILITY + destination-link result from executeInsurance -- this scope-check's
  // generic broadening-consent CLARIFY must not override that with a blank geography.
  if(session.hub==='insurance'&&session.insuranceResearchMode==='local_directory_handoff')return session;
  if(!scope.requestedGeography||session.identifier||session.identityName)return session;
  if(['contractor','move','investor','insurance','lender'].includes(session.hub??'')&&['SERVICE_TERRITORY','ORIGIN_DESTINATION'].includes(scope.requestedGeographyMeaning??''))return session;
  if(scope.executionAllowed)return session;
  // TH-DISCOVERY-RESET-001: RESULTS FIRST. This used to stop here and hand the consumer a bare
  // "Research <state> instead" button with zero providers -- a second action just to see any
  // business, for a DISCOVERY query (identifier/identityName lookups already returned above,
  // before this point, so everything reaching here is a provider-class+geography browse, never a
  // verification/exact-identity request). Auto-broaden to state instead: resolve the SAME
  // approved-broader-geography scope the explicit consent handler (orchestrator.ts's afterChoice)
  // would have produced, and execute it immediately. The requested-vs-executed distinction still
  // renders (session.executionScope.requestedGeography stays the original ask; executionGeography
  // becomes the state) so claim strength stays honest -- this is a labeled broadening, not a
  // silent one. AUTOMATIC_BROADENING is a distinct reason code from EXPLICIT_SCOPE_CONSENT so any
  // consumer surface that wants to phrase these differently can.
  if(scope.resolutionState==='BROADENING_REQUIRES_CONSENT'&&scope.normalizedRequestedGeography?.stateCode){
    const req=scope.normalizedRequestedGeography;
    const stateCode=req.stateCode!;
    const autoScope=resolveResearchScope(session.researchPlan,{approvedBroaderGeography:{kind:'state',display:req.stateName??stateCode,stateCode,stateName:req.stateName}});
    if(autoScope.executionAllowed){
      const narrowChoices:GuidedChoice[]=req.display==='Tampa Bay, Florida'?[
        {id:'scope-tampa',label:'Narrow to Tampa / Hillsborough County',action:'SELECT_CHOICE',value:'scope_place:Tampa, Florida'},
        {id:'scope-st-pete',label:'Narrow to St. Petersburg / Pinellas County',action:'SELECT_CHOICE',value:'scope_place:St. Petersburg, Florida'},
        {id:'scope-clearwater',label:'Narrow to Clearwater / Pinellas County',action:'SELECT_CHOICE',value:'scope_place:Clearwater, Florida'},
      ]:[];
      // researchPlan.executionAllowed (a separate flag from executionScope.executionAllowed) must
      // also flip, mirroring exactly what the explicit-consent handler (orchestrator.ts's
      // afterChoice, scope_state: branch) already does -- otherwise orchestrator.ts's own
      // `!session.researchPlan.executionAllowed` guard bounces this straight back to CLARIFY
      // despite the scope itself now genuinely being executable.
      return {...session,executionScope:{...autoScope,reasonCodes:[...autoScope.reasonCodes,'AUTOMATIC_BROADENING']},researchPlan:{...session.researchPlan,executionAllowed:true,executionMode:'COHORT',missingSlots:[],clarificationReason:undefined,reasonCodes:[...session.researchPlan.reasonCodes,'AUTOMATIC_BROADENING']},geography:{type:'state',value:stateCode,stateCode,stateName:req.stateName,meaning:autoScope.executionGeographyMeaning},availableChoices:narrowChoices,missingFields:[],phase:'EXECUTE',nextAction:'execute'};
    }
  }
  // Even state-grain broadening isn't executable (e.g. a non-US-recognized place, or a hub with no
  // state capability at all) -- this remains a genuine dead end; offer whatever narrower manual
  // choices exist (Tampa Bay's named sub-areas) rather than fabricating a result.
  const choices:GuidedChoice[]=[];
  if(scope.normalizedRequestedGeography?.display==='Tampa Bay, Florida'){
    choices.push(
      {id:'scope-tampa',label:'Tampa / Hillsborough County',action:'SELECT_CHOICE',value:'scope_place:Tampa, Florida'},
      {id:'scope-st-pete',label:'St. Petersburg / Pinellas County',action:'SELECT_CHOICE',value:'scope_place:St. Petersburg, Florida'},
      {id:'scope-clearwater',label:'Clearwater / Pinellas County',action:'SELECT_CHOICE',value:'scope_place:Clearwater, Florida'},
      {id:'scope-other',label:'Another city or county',action:'SELECT_CHOICE',value:'scope_other',description:'Enter the specific place you want researched.'},
    );
  }
  return {...session,geography:undefined,phase:'CLARIFY',missingFields:scope.resolutionState==='CLARIFICATION_REQUIRED'&&!choices.length?['geography']:[],availableChoices:choices,nextAction:scope.disclosure??'The requested local scope is not executable by this specialist.'};
}

export function refreshCareSession(session:GuidedResearchSession,setting:CareSetting|undefined=session.researchPlan.careSetting,selectedGeography?:GuidedGeography):GuidedResearchSession {
  const basePlan=planAskResearch(session.originalQuestion);
  const original=basePlan.requestedGeography;
  const geography=selectedGeography?{raw:original?.raw??selectedGeography.value,display:selectedGeography.city?`${selectedGeography.city}${selectedGeography.stateName?`, ${selectedGeography.stateName}`:''}`:selectedGeography.value,kind:selectedGeography.type,resolution:selectedGeography.stateCode?'RESOLVED' as const:'UNRESOLVED' as const,stateCode:selectedGeography.stateCode,stateName:selectedGeography.stateName,city:selectedGeography.city,county:selectedGeography.county}:original;
  if(geography?.kind==='county'&&geography.county)geography.display=`${geography.county} County${geography.stateName?`, ${geography.stateName}`:''}`;
  const plan=planCareResearch(basePlan,setting,geography),scope=resolveResearchScope(plan);
  const geo:GuidedGeography|undefined=geography&&['city','state','county','zip'].includes(geography.kind)?{type:geography.kind as GuidedGeography['type'],value:geography.city??geography.county??geography.stateCode??geography.display,city:geography.city,county:geography.county,stateCode:geography.stateCode,stateName:geography.stateName,meaning:'Recorded provider/office location; not service area.'}:undefined;
  const providerClass=setting&&['nursing_home','home_health','hospice'].includes(setting)?setting as GuidedResearchSession['providerClass']:undefined;
  const availableRefinements=Object.keys(session.selectedFilters).map(id=>({id,label:'Requested CMS rating',values:[1,2,3,4,5].map(n=>({value:String(n),label:String(n)}))}));
  return {...session,availableRefinements:session.availableRefinements.length?session.availableRefinements:availableRefinements,hub:'senior',researchPlan:plan,executionScope:scope,geography:geo,providerClass,entityClass:setting,phase:plan.executionAllowed&&scope.executionAllowed?'EXECUTE':!setting?'CLARIFY':plan.missingSlots.includes('geography')?'COLLECT':'CLARIFY',missingFields:plan.missingSlots,availableChoices:!setting&&!plan.identifier?structuredClone(CARE_CHOICES):[],nextAction:plan.executionAllowed&&scope.executionAllowed?'execute':plan.clarificationReason??scope.disclosure};
}

export function isGuidedResearchCandidate(question: string): boolean {
  return createGuidedSession(question) !== null;
}

export function pushHistory(session: GuidedResearchSession): GuidedResearchSession {
  return { ...session, history: [...session.history.slice(-7), snapshot(session)] };
}

export function restorePrevious(session: GuidedResearchSession): GuidedResearchSession {
  const previous = session.history.at(-1);
  if (!previous) return session;
  return {
    ...structuredClone(previous),
    version:session.version,sessionId:session.sessionId,originalQuestion:session.originalQuestion,
    createdAt:session.createdAt,updatedAt:new Date().toISOString(),history:session.history.slice(0,-1),
  };
}

export { CARE_CHOICES, TRADE_CHOICES, MOVE_CHOICES, INVESTOR_CHOICES, INSURANCE_CHOICES, LENDER_CHOICES };
