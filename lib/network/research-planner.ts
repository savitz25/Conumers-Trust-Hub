import { mnAmbiguousNumber, mnIdentifier, mnRefusal, mnRankingAsked, queryLooksLikeMinnesota, classifyMnHub } from './mn-network.ts';
import { miAmbiguousNumber, miIdentifier, miRefusal, miRankingAsked, queryLooksLikeMichigan, classifyMiHub } from './mi-network.ts';
import { ctAmbiguousNumber, ctIdentifier, ctRefusal, ctRankingAsked, queryLooksLikeConnecticut, classifyCtHub } from './ct-network.ts';
import { mdAmbiguousNumber, mdIdentifier, mdRefusal, mdRankingAsked, queryLooksLikeMaryland, classifyMdHub } from './md-network.ts';
import { wiAmbiguousNumber, wiIdentifier, wiRefusal, wiRankingAsked, queryLooksLikeWisconsin, classifyWiHub } from './wi-network.ts';
import { kyAmbiguousNumber, kyIdentifier, kyRefusal, kyRankingAsked, queryLooksLikeKentucky, classifyKyHub } from './ky-network.ts';
import { laAmbiguousNumber, laIdentifier, laRefusal, laRankingAsked, queryLooksLikeLouisiana, classifyLaHub } from './la-network.ts';
import { msAmbiguousNumber, msIdentifier, msRefusal, msRankingAsked, queryLooksLikeMississippi, classifyMsHub } from './ms-network.ts';
import { moAmbiguousNumber, moIdentifier, moRefusal, moRankingAsked, queryLooksLikeMissouri, classifyMoHub } from './mo-network.ts';
import { iaAmbiguousNumber, iaIdentifier, iaRefusal, iaRankingAsked, queryLooksLikeIowa, classifyIaHub } from './ia-network.ts';
import { neAmbiguousNumber, neIdentifier, neRefusal, neRankingAsked, queryLooksLikeNebraska, classifyNeHub } from './ne-network.ts';
import { ksRefusal, ksRankingAsked, queryLooksLikeKansas, classifyKsHub } from './ks-network.ts';
import { idAmbiguousNumber, idIdentifier, idRefusal, idRankingAsked, queryLooksLikeIdaho, classifyIdHub } from './id-network.ts';
import { wvAmbiguousNumber, wvIdentifier, wvRefusal, wvRankingAsked, queryLooksLikeWestVirginia, classifyWvHub } from './wv-network.ts';
import { okAmbiguousNumber, okIdentifier, okRefusal, okRankingAsked, queryLooksLikeOklahoma, classifyOkHub } from './ok-network.ts';
import { arAmbiguousNumber, arIdentifier, arRefusal, arRankingAsked, queryLooksLikeArkansas, classifyArHub } from './ar-network.ts';
import { utAmbiguousNumber, utIdentifier, utRankingAsked, utRefusal, queryLooksLikeUtah, classifyUtHub } from './ut-network.ts';
import { nmAmbiguousNumber, nmIdentifier, nmRankingAsked, nmRefusal, queryLooksLikeNewMexico, classifyNmHub } from './nm-network.ts';
import { scAmbiguousNumber, scIdentifier, scRefusal, scRankingAsked, queryLooksLikeSouthCarolina, classifyScHub } from './sc-network.ts';
import { alAmbiguousNumber, alIdentifier, alRefusal, alRankingAsked, queryLooksLikeAlabama, classifyAlHub } from './al-network.ts';
import { inAmbiguousNumber, inIdentifier, inRefusal, inRankingAsked, queryLooksLikeIndiana, classifyInHub } from './in-network.ts';
import { parseNetworkAsk, type ParsedGeography } from './ask-parse.ts';
import {careTask,careLocation,planCareResearch,type CareSetting} from './care-task.ts';
import { investorFailClosedReason, isInvestorAdviserSeekingQuery, isUnsupportedSecuritiesAdviceQuery } from './investor-ask.ts';
import type { SpecialistHubId } from './registry.ts';
import { classifyTnHub, queryLooksLikeTennessee, tnBareLicenseAmbiguous, tnExactCredentialRoute, tnLabeledIdentifier } from './tn-network.ts';
import { classifyNvHub, nvBareLicenseAmbiguous, nvExactCredentialRoute, nvIdentifierRoute, nvLabeledIdentifier, queryLooksLikeNevada } from './nv-network.ts';
import { stripTrustQualifierWrapper, type UniversalQueryType } from './query-classification.ts';
import { FLORIDA_MUNICIPALITY_CROSSWALK, resolveFloridaMunicipality } from './florida-municipality-crosswalk.ts';

export const ASK_RESEARCH_INTENTS = [
  'IDENTIFIER_LOOKUP', 'ENTITY_LOOKUP', 'ENTITY_LOOKUP_MISSING_IDENTITY',
  'COHORT_BROWSE', 'HOW_TO', 'EXPLAINER', 'COMPARE',
  'RECOMMENDATION_REQUEST', 'MULTI_HUB_JOURNEY',
] as const;
export type AskResearchIntent = (typeof ASK_RESEARCH_INTENTS)[number];

export type AskRequestedGeography = {
  raw: string;
  display: string;
  kind: 'state' | 'county' | 'city' | 'zip' | 'region' | 'route' | 'place';
  resolution: 'RESOLVED' | 'UNRESOLVED';
  stateCode?: string;
  stateName?: string;
  county?: string;
  city?: string;
  zip?: string;
  origin?: string;
  destination?: string;
};

export type AskResearchPlan = {
  careSetting?: CareSetting;
  version: 'ask-research-plan-v1';
  originalQuestion: string;
  intent: AskResearchIntent;
  primaryHub?: SpecialistHubId;
  candidateHubs: SpecialistHubId[];
  entityClass?: { id: string; label: string; matchedText?: string };
  identifier?: { type: string; value: string; raw: string };
  entityName?: string;
  requestedGeography?: AskRequestedGeography;
  normalizedGeography?: ParsedGeography;
  requestedEvidence: string[];
  missingSlots: string[];
  executionAllowed: boolean;
  executionMode: 'IDENTIFIER' | 'IDENTITY' | 'COHORT' | 'CLARIFY';
  clarificationReason?: string;
  reasonCodes: string[];
  legacyQueryType: UniversalQueryType;
};

type PlannerOverrides = { proposedIntent?: AskResearchIntent; proposedEntityName?: string };

// TH-DISCOVERY-003: "verify X before I book/hire" is a verification-workflow question, not a
// request to browse every company in the entity class -- "verify moving company before I book"
// used to fall through to an entity-only cohort call (no geography) that legitimately, but
// unhelpfully, returned zero rows instead of HOW_TO guidance.
const HOW_TO = /\b(?:how\s+(?:do|can|should|would)\s+i|how\s+to|what\s+(?:should|do)\s+i\s+(?:look|read|check)|loan\s+estimate\s+what\s+matters|ways?\s+to|verify\b[^?.!]{0,60}\bbefore\s+i\b)\b/i;
const EXPLAINER = /\b(?:what\s+(?:is|are|does)|define|definition|explain|difference\s+between|what\s+do\s+.+\s+mean|does\s+.+\s+mean|(?:current|active|registered|licensed|published)\b.{0,35}\bmeans?)\b/i;
const STATUS_EXPLAINER=/\b(?:current|active|registered|licensed|published|vendor\s+registration|HMDA|CMS\s+stars?|no\s+(?:match|enforcement|complaints?))\b[^?.!]{0,70}\b(?:mean|equal|prove|endorse|recommend|trustworthy|approved|clean|good|license)\b/i;
const RECOMMENDATION = /\b(?:best|safest|most\s+trustworthy|legitimate|recommended|top|good)\b/i;
// TH-SEARCH-R1-018 BLOCKER-SENIOR-01: "nursing home"/"assisted living (facility)?"/"hospice"/
// "senior home"/"senior facility" must be recognized as deictic care-provider nouns the same way
// "facility" and "home health agency" already are, or a bare "this nursing home?" reference with
// no established identity falls through to explicitEntityName()'s residue-fallback heuristic and
// captures the entire question as a fabricated literal facility name.
const DEICTIC_ENTITY = /\b(?:this|that)\s+(?:company|firm|facility|place|agency|contractor|roofer|roof\s+guy|mover|moving\s+company|lender|advis(?:er|or)|financial\s+advis(?:er|or)|investment\s+advis(?:er|or)|agent|insurance\s+agent|guy|home\s+health\s+agency|nursing\s+home|assisted\s+living(?:\s+facility)?|hospice|senior\s+home|senior\s+facility)\b|\bmy\s+(?:company|contractor|mover|moving\s+company|lender|advis(?:er|or)|agent|agency)\b|\b(?:hire|research|check)\b[^?.!]{0,80}\b(?:them|him|her)\b/i;

function dedupe<T>(values: T[]): T[] { return [...new Set(values)]; }
const EXPLICIT_SECOND_TASK = /\b(?:and also|and then|plus|as well as)\s+(?:find|research|look\s+up|verify|compare|browse)\b/i;

function inferHubs(query: string, parsed: ReturnType<typeof parseNetworkAsk>): SpecialistHubId[] {
  // A labeled identifier names its specialist even when an unrelated category word follows.
  // Retain the existing multi-hub choice only when the consumer explicitly asks for a second
  // task; a lone trailing word ("USDOT 1234567 contractor") is not such a request.
  if (parsed.identifier && !parsed.identifier.ambiguous && !EXPLICIT_SECOND_TASK.test(query)) {
    return [parsed.identifier.family.hubId];
  }
  if(/\bMedicare\s+insurance\b/i.test(query))return ['insurance'];
  const care=careTask(query);
  if(care?.kind==='move_context')return ['move'];
  if(care?.kind==='care_and_move')return ['senior','move'];
  if(care?.kind==='care')return ['senior'];
  const hubs = [...parsed.suggestedHubs];
  const explicit: SpecialistHubId[] = [];
  const patterns: Array<[SpecialistHubId, RegExp]> = [
    ['move', /\b(?:move(?:r|rs)?|moving|moving\s+compan(?:y|ies)|relocat(?:e|ing|ion)|USDOT|\bMC\b|DPU\s+certificate|carrier|ship\s+(?:my|a)\s+(?:car|vehicle))\b/i],
    ['lender', /\b(?:lender|mortgage|refinance|refinancing|NMLS|LEI|HMDA|loan\s+estimate|loan\s+officer)\b/i],
    ['insurance', /\b(?:insurance|insurer|NPN|NAIC|producer)\b/i],
    // POST-R1-ASK-INTENT-001R: bare "Medicare" matched "medicare supplement agent in ohio",
    // adding 'senior' alongside 'insurance' to candidateHubs and surfacing SeniorTrustHub as a
    // multi-hub choice -- the exact "Do NOT route 'Medicare supplement agent' to SeniorTrustHub
    // merely because it contains Medicare" case the original ticket named explicitly. "Medicare
    // supplement"/"Medigap" are insurance products (mirrors insurance-ask.ts's own
    // MEDICARE_SUPPLEMENT_RE guard); everything else containing "Medicare" (e.g. "Medicare
    // certified") stays senior vocabulary.
    ['senior', /\b(?:nursing\s+(?:home|facility|facilities)|home\s+health|senior\s+care|hospice|CMS|CCN|Medicare(?!\s+supplement)|star\s+ratings?)\b/i],
    // TH-ARCH-P0-001: plural forms ("locksmiths", "electricians") previously fell outside these
    // \b-bounded singular patterns, which starved the intent==='place'&&explicit.length narrowing
    // below of a match and let the generic multi-hub geography fallback leak in as a false
    // multi-domain signal for an ordinary single-vertical trade query.
    ['contractor', /\b(?:contractors?|roofers?|roof(?:ing)?(?:\s+guy)?|HVAC|electricians?|plumbers?|locksmiths?|hearth|telecom|mechanical|CBC|CGC|CCC)\b/i],
    ['investor', /\b(?:financial\s+advis(?:er|or)|investment\s+advis(?:er|or)|RIA|ERA|CRD|SEC|(?:Form\s+)?ADV|IARD|principal\s+office|who can help me invest)\b/i],
  ];
  for (const [hub, pattern] of patterns) if (pattern.test(query)) explicit.push(hub);
  if (isInvestorAdviserSeekingQuery(query)) explicit.push('investor');
  // ATH-TN-001: Tennessee-only credential words (HIC, LLE, LLP, ACLF, RHA, notice filing) are
  // classified only when the parsed geography is already Tennessee; other states are unchanged.
  if (parsed.geography?.stateCode === 'TN' && queryLooksLikeTennessee(query) && !tnBareLicenseAmbiguous(query)) {
    // An exact Tennessee credential (contractor license, HFC class license, SEC file) names its hub;
    // any other labeled identifier keeps the shared identifier parser's hub.
    const tnHub = tnExactCredentialRoute(query)?.hubId ?? (tnLabeledIdentifier(query) ? undefined : classifyTnHub(query));
    if (tnHub && !explicit.includes(tnHub)) explicit.push(tnHub);
  }
  // ATH-NV-001: Nevada-only credential words (RFG, HIC = Home for Individual Residential Care, HCQC, CPCN,
  // MLO, notice filing) are classified only when Nevada itself is the named state; others are unchanged.
  if (parsed.geography?.stateCode === 'NV' && queryLooksLikeNevada(query) && !nvBareLicenseAmbiguous(query)) {
    const nvHub = nvExactCredentialRoute(query)?.hubId ?? (nvLabeledIdentifier(query) ? undefined : classifyNvHub(query));
    if (nvHub) {
      const at = explicit.indexOf(nvHub);
      if (at >= 0) explicit.splice(at, 1);
      explicit.unshift(nvHub);
      // Nevada HIC is senior care, not a home improvement contractor.
      if (nvHub === 'senior' && /\bhic\b/i.test(query)) {
        const c = explicit.indexOf('contractor');
        if (c >= 0) explicit.splice(c, 1);
      }
    }
  } else if (parsed.geography?.stateCode !== 'NV') {
    const nvId = nvIdentifierRoute(query, queryLooksLikeTennessee(query));
    if (nvId && !explicit.includes(nvId.hubId)) explicit.unshift(nvId.hubId);
  }
  if(parsed.intent==='place'&&explicit.length)return dedupe(explicit);
  return dedupe([...hubs,...explicit]);
}

function entityClass(query: string, parsed: ReturnType<typeof parseNetworkAsk>): AskResearchPlan['entityClass'] {
  const classified = parsed.queryClassification.entityClass;
  // TH-DISCOVERY-GEN-001: keep the actual regex-matched substring alongside the generic display
  // label -- explicitEntityName() strips category words out of the query to decide whether
  // anything "real" is left, and a fixed label (e.g. "Auto transport company") often doesn't
  // textually match the words the consumer actually used (e.g. "auto transport carrier"),
  // leaving the category words un-stripped and falsely read as a literal company name.
  if (classified) return { id: classified.id, label: classified.label, matchedText: classified.matchedText };
  if (parsed.seniorProviderClass) return { id: parsed.seniorProviderClass, label: parsed.seniorProviderClass.replaceAll('_', ' ') };
  if (/\bdpu\s+certificate\b/i.test(query)) return { id: 'mover', label: 'Moving company', matchedText: 'DPU certificate' };
  if (/\b(?:moving\s+compan(?:y|ies)|movers?)\b/i.test(query)) return { id: 'mover', label: 'Moving company' };
  // TH-DISCOVERY-003: "moving brokers in florida" fell through every branch here (matches neither
  // "moving compan(y|ies)" nor bare "movers?"), landing on ENTITY_LOOKUP_MISSING_IDENTITY -- a
  // genuine dead end (missingSlots:['entityName'], executionAllowed:false, no path forward) worse
  // than an unsupported-geography case. "moving broker" is unambiguous with mortgage/insurance
  // broker phrasing, which never carries the word "moving".
  if (/\bmoving\s+brokers?\b/i.test(query)) return { id: 'mover', label: 'Moving company' };
  if (/\b(?:who\s+can\s+move|moving\s+from|move\s+me\s+from)\b/i.test(query)) return { id: 'mover', label: 'Moving company' };
  if (/\b(?:roofers?|roof(?:ing)?\s+(?:contractors?|guy))\b/i.test(query)) return { id: 'roofing_contractor', label: 'Roofing contractor' };
  if (/\bcontractors?\b/i.test(query)) return { id: 'contractor', label: 'Contractor' };
  if (/\b(?:locksmiths?|hearth\s+specialists?|telecom(?:munications?)?|mechanical)\b/i.test(query)) return { id: 'contractor', label: 'Contractor' };
  if (/\b(?:auto\s+transport|ship\s+(?:my|a)\s+(?:car|vehicle)|transport\s+my\s+(?:car|vehicle))\b/i.test(query)) return { id: 'auto_transport', label: 'Auto transport company' };
  if (/\b(?:mortgage\s+)?lenders?\b/i.test(query)) return { id: 'mortgage_lender', label: 'Mortgage lender' };
  if (/\brefinanc(?:e|ing)\b/i.test(query)) return { id: 'mortgage_lender', label: 'Mortgage lender' };
  if (/\b(?:HMDA|originations?|applications?|denials?|\bFHA\b|\bVA\b|\bUSDA\b)\b/i.test(query) && parsed.suggestedHubs.includes('lender')) return { id: 'hmda_reporting_institution', label: 'HMDA reporting institution' };
  if (/\b(?:financial|investment)\s+advis(?:er|or)s?\b/i.test(query) || isInvestorAdviserSeekingQuery(query)) return { id: 'investment_adviser', label: 'Investment adviser' };
  if (/\binsurance\s+agents?\b/i.test(query)) return { id: 'insurance_producer', label: 'Insurance producer' };
  if (/\binsurance\s+compan(?:y|ies)\b/i.test(query)) return { id: 'legal_insurer', label: 'Legal insurer' };
  if (/\bhome\s+health(?:\s+agency)?\b/i.test(query)) return { id: 'home_health', label: 'Home Health' };
  return undefined;
}

function title(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requestedGeography(query: string, parsed: ReturnType<typeof parseNetworkAsk>): AskRequestedGeography | undefined {
  const route=query.match(/\bfrom\s+([a-z][a-z .'-]{1,40}?)\s+to\s+([a-z][a-z .'-]{1,40}?)(?=\s+and\s+(?:buying|renting|looking|researching)\b|[?,.!]|\s+who\b|$)/i);
  if(route){const origin=title(route[1].trim());const destination=title(route[2].trim());return {raw:route[0],display:`${origin} to ${destination}`,kind:'route',resolution:'RESOLVED',origin,destination};}
  const known: Array<[RegExp, string, AskRequestedGeography['kind'], AskRequestedGeography['resolution']]> = [
    [/\btampa\s+bay(?:\s*,?\s*florida|\s*,?\s*fl)?\b/i, 'Tampa Bay, Florida', 'region', 'UNRESOLVED'],
    [/\bfort\s+lauderdale(?:\s*,?\s*florida|\s*,?\s*fl)?\b/i, 'Fort Lauderdale, Florida', 'city', 'RESOLVED'],
    [/\bft\.?\s+lauderdale(?:\s*,?\s*florida|\s*,?\s*fl)?\b/i, 'Fort Lauderdale, Florida', 'city', 'RESOLVED'],
    [/\bwest\s+palm\s+beach(?:\s*,?\s*florida|\s*,?\s*fl)?\b/i, 'West Palm Beach, Florida', 'city', 'RESOLVED'],
    [/\bboca\s+raton(?:\s*,?\s*florida|\s*,?\s*fl)?\b/i, 'Boca Raton, Florida', 'city', 'RESOLVED'],
    [/\bbroward(?:\s+county)?(?:\s*,?\s*florida|\s*,?\s*fl)?\b/i, 'Broward County, Florida', 'county', 'RESOLVED'],
    [/\bsummit\s+county(?:\s*,?\s*new\s+jersey|\s*,?\s*nj)?\b/i, 'Summit County, New Jersey', 'county', 'RESOLVED'],
    [/\bpalm\s+beach\s+county(?:\s*,?\s*florida|\s*,?\s*fl)?\b/i, 'Palm Beach County, Florida', 'county', 'RESOLVED'],
    [/\btampa(?:\s*,?\s*florida|\s*,?\s*fl)\b/i, 'Tampa, Florida', 'city', 'RESOLVED'],
    [/\batlanta\b/i, 'Atlanta', 'city', 'UNRESOLVED'],
    // TH-DISCOVERY-RESET-001 (production certification fix): a stale, pre-crosswalk hardcoded
    // `[/\bboca\b/i, 'Boca', 'place', 'UNRESOLVED']` entry used to live here and short-circuited
    // this loop before ever reaching the crosswalk fallback below, so "movers in Boca" (no
    // "Raton") always stayed an unresolved dead end even though florida-municipality-
    // crosswalk.ts's own `boca` alias already resolves it correctly to Boca Raton, Palm Beach.
  ];
  for (const [pattern, display, kind, resolution] of known) {
    const match = query.match(pattern);
    if (match){
      const city=kind==='city'?display.replace(/,.*$/,''):undefined;
      const mapped=city?resolveFloridaMunicipality(city):undefined;
      const county=kind==='county'?(display.startsWith('Summit County')?'Summit County':display.replace(/ County,.*$/,'')):mapped?.county;
      return { raw: match[0].replace(/\s*,\s*/g, ' ').trim(), display, kind, resolution,stateCode:/Florida/i.test(display)?'FL':/New Jersey/i.test(display)?'NJ':undefined,stateName:/Florida/i.test(display)?'Florida':/New Jersey/i.test(display)?'New Jersey':undefined,city:mapped?.city??city,county };
    }
  }
  const queryKey=query.toLowerCase().replace(/[?,!]/g,' ');
  const flMatch=Object.keys(FLORIDA_MUNICIPALITY_CROSSWALK).sort((a,b)=>b.length-a.length).find(city=>new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(queryKey));
  if(flMatch){const mapped=resolveFloridaMunicipality(flMatch)!;return {raw:flMatch,display:`${mapped.city}, Florida`,kind:'city',resolution:'RESOLVED',stateCode:'FL',stateName:'Florida',city:mapped.city,county:mapped.county};}
  if (parsed.geography) {
    const geo = parsed.geography;
    if (!geo.stateName && !geo.stateCode && !geo.countyName && !geo.city) {
      return {
        raw: geo.meaning,
        display: geo.meaning,
        kind: 'place',
        resolution: 'UNRESOLVED',
      };
    }
    const match = query.match(/\b(?:in|near|around|within)\s+([a-z][a-z .'-]*?(?:county)?(?:\s*,?\s*(?:florida|texas|california|new\s+jersey|fl|tx|ca|nj))?)\b(?=\s+(?:for|and|with|that|which)\b|[?.!,]|$)/i);
    const raw = match?.[1]?.trim() ?? geo.countyName ?? geo.city ?? geo.stateName ?? geo.stateCode!;
    const display = geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.city ? `${geo.city}, ${geo.stateName}` : geo.stateName!;
    return { raw, display, kind: geo.countyName ? 'county' : geo.city ? 'city' : 'state', resolution: 'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,county:geo.countyName?.replace(/ County$/i,''),city:geo.city };
  }
  const loose = query.match(/\b(?:in|near|around|within)\s+([a-z][a-z .'-]{1,45}?)(?=\s+(?:for|and|with|that|which)\b|[?.!,]|$)/i);
  if (loose?.[1] && !/^(?:me|here)$/i.test(loose[1].trim())) return { raw: loose[1].trim(), display: title(loose[1].trim()), kind: 'place', resolution: 'UNRESOLVED' };
  return undefined;
}

const ENTITY_NAME_LEADING_STOPWORDS = /^(?:Can|Is|Does|Will|Would|Could|Should|What|Who|Where|When|Why|How|Do|My|The|A|An|Please|I)$/;
// Identifier-family label tokens (identifiers.ts): a capitalized run led by one of these is a
// probable malformed/attempted identifier ("NAIC ABCD"), not a company name, so must not be
// reinterpreted as an entity name.
const IDENTIFIER_LABEL_TOKEN = /^(?:NAIC|CBC|CGC|CCC|CRD|NPN|NMLS|LEI|USDOT|DOT|MC|CCN)$/i;

function properNounCandidate(query: string, geography: AskRequestedGeography | undefined): string | undefined {
  const runs = query.match(/\b[A-Z][a-zA-Z0-9'&.-]*(?:\s+[A-Z][a-zA-Z0-9'&.-]*)*\b/g) ?? [];
  for (const run of runs) {
    const words = run.split(/\s+/);
    let start = 0;
    while (start < words.length && ENTITY_NAME_LEADING_STOPWORDS.test(words[start])) start++;
    const kept = words.slice(start);
    if (kept.length < 2 || IDENTIFIER_LABEL_TOKEN.test(kept[0])) continue;
    const candidate = kept.join(' ');
    if (geography?.origin && candidate.toLowerCase().includes(geography.origin.toLowerCase())) continue;
    if (geography?.destination && candidate.toLowerCase().includes(geography.destination.toLowerCase())) continue;
    return candidate;
  }
  return undefined;
}

function explicitEntityName(query: string, entity: AskResearchPlan['entityClass'], geography: AskRequestedGeography | undefined): string | undefined {
  const quoted = query.match(/["“]([^"”]{2,160})["”]/)?.[1]?.trim();
  if (quoted) return quoted;
  const introduced = query.match(/\b(?:named|called)\s+(.+?)(?=[?.!,]|$)/i)?.[1]?.trim();
  if (introduced) return introduced;
  const evidenceSubject = query.match(/\b(?:complaints?\s+(?:about|against)|research|look\s+up|check)\s+([a-z0-9&.' -]+?)(?=[?.!,]|$)/i)?.[1]?.trim();
  if (evidenceSubject && !/^(?:a|an|the|this|that|my)\b/i.test(evidenceSubject)) return evidenceSubject;
  // POST-R1-ASK-INTENT-001R (browser QA finding): "is rocket mortgage legit" and "is abbey
  // delray south medicare certified" never reached any branch below -- lowercase, no quotes/
  // LLC suffix/"named X" phrasing, and (for the first) no entity class matched at all -- so
  // this returned undefined and the guided-research UI asked the consumer to re-type the name
  // it had just been given ("NMLS number or lender name"), contradicting the ticket's explicit
  // "Rocket Mortgage is extracted as the entity" requirement. Reuse the same trust-qualifier
  // stripper ask-parse.ts's query-classification.ts already applies, and treat what's left as
  // the entity name whenever stripping actually removed a wrapper (a narrow, specific trigger,
  // not a general lowercase-name heuristic).
  const trustStripped = stripTrustQualifierWrapper(query);
  if (trustStripped !== query) {
    const trimmedStripped = trustStripped.replace(/[?.!]+$/g, '').trim();
    if (trimmedStripped && trimmedStripped.split(/\s+/).length <= 6) return trimmedStripped;
  }
  if (/\b(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|LLP|L\.P\.)\b/i.test(query)) return query.replace(/[?.!]+$/g, '').trim();
  if (!entity && /^[A-Z][A-Z0-9&.-]{2,40}$/.test(query.trim())) return query.trim();
  if (entity && !geography && !/\b(?:in|near|nearby|around|within|how|which|what|is\s+this|is\s+my|show|find|need|serving|headquartered)\b/i.test(query)) {
    // TH-DISCOVERY-GEN-001: strip the actual matched category text (matchedText), not just the
    // fixed display label -- a multi-word category phrase (e.g. "auto transport carrier") often
    // doesn't literally contain its own generic label ("Auto transport company"), so stripping the
    // label leaves the whole category phrase behind and it gets misread as a literal company name.
    const categoryText = entity.matchedText ?? entity.label;
    const residue = query.replace(new RegExp(categoryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ').replace(/\b(?:moving\s+company|movers?|contractors?|lenders?|nursing\s+homes?)\b/gi, ' ').replace(/[^a-z0-9&]+/gi, ' ').trim();
    if (residue.split(/\s+/).length >= 2) return query.replace(/[?.!]+$/g, '').trim();
  }
  // Bare multi-word proper-noun company name as the whole query (e.g. "JK Moving Services"):
  // require the entire trimmed query to be title-case words, not a scan for a substring inside
  // an arbitrary sentence, so unrelated capitalized phrases in longer sentences can't match here.
  if (!entity && !geography) {
    const trimmed = query.replace(/[?.!]+$/g, '').trim();
    const words = trimmed.split(/\s+/);
    if (words.length >= 2 && words.length <= 6 && words.every((w) => /^[A-Z][a-zA-Z0-9'&.-]*$/.test(w)) && !IDENTIFIER_LABEL_TOKEN.test(words[0])) {
      return trimmed;
    }
  }
  // Company name embedded alongside origin/destination route language
  // (e.g. "Can JK Moving handle my move from Virginia to Florida?").
  if (geography?.kind === 'route') {
    const candidate = properNounCandidate(query, geography);
    if (candidate) return candidate;
  }
  return undefined;
}

function requestedEvidence(query: string): string[] {
  const rows: Array<[RegExp, string]> = [
    [/\blicen[sc](?:e|ed|ing)|registered|credential/i, 'REGULATORY_STATUS'],
    [/\bcomplaints?|enforcement|discipline/i, 'REGULATORY_HISTORY'],
    [/\bCMS\s+star|star\s+ratings?/i, 'SOURCE_RATING'],
    [/\bMedicare\s+certified/i, 'MEDICARE_CERTIFICATION'],
    [/\bForm\s+ADV/i, 'FORM_ADV'],
    [/\bLoan\s+Estimate/i, 'LOAN_ESTIMATE'],
  ];
  return rows.filter(([pattern]) => pattern.test(query)).map(([, code]) => code);
}

function legacyType(intent: AskResearchIntent): UniversalQueryType {
  if (intent === 'IDENTIFIER_LOOKUP') return 'EXACT_IDENTIFIER';
  if (intent === 'ENTITY_LOOKUP') return 'IDENTITY_NAME';
  if (intent === 'COHORT_BROWSE' || intent === 'RECOMMENDATION_REQUEST') return 'COHORT';
  if (intent === 'MULTI_HUB_JOURNEY') return 'LIFE_SITUATION';
  if (intent === 'EXPLAINER') return 'DEFINITION';
  if (intent === 'HOW_TO') return 'EVIDENCE_QUERY';
  return 'MISSING_SLOTS';
}

export function planAskResearch(question: string, overrides: PlannerOverrides = {}): AskResearchPlan {
  const originalQuestion = question.trim();
  const newMexico = queryLooksLikeNewMexico(originalQuestion);
  if (newMexico) {
    const identifier = nmIdentifier(originalQuestion);
    const primaryHub = identifier?.hub ?? classifyNmHub(originalQuestion);
    const geo = parseNetworkAsk(originalQuestion).geography;
    const clarificationReason = nmRefusal(originalQuestion)!;
    return {
      version: 'ask-research-plan-v1', originalQuestion,
      intent: nmAmbiguousNumber(originalQuestion) ? 'ENTITY_LOOKUP_MISSING_IDENTITY' : nmRankingAsked(originalQuestion) ? 'RECOMMENDATION_REQUEST' : identifier ? 'IDENTIFIER_LOOKUP' : primaryHub ? 'COHORT_BROWSE' : 'EXPLAINER',
      primaryHub, candidateHubs: primaryHub ? [primaryHub] : [],
      identifier: identifier ? { type: identifier.type, value: identifier.value, raw: identifier.raw } : undefined,
      normalizedGeography: geo,
      requestedGeography: geo?.stateCode ? { raw: geo.stateName!, display: geo.stateName!, kind: 'state', resolution: 'RESOLVED', stateCode: geo.stateCode, stateName: geo.stateName } : undefined,
      requestedEvidence: [], missingSlots: ['sourceOrScope'], executionAllowed: false, executionMode: 'CLARIFY',
      clarificationReason, reasonCodes: ['NEW_MEXICO_SPECIALIST_HANDOFF', 'SPECIALIST_EXECUTION_BLOCKED'], legacyQueryType: identifier ? 'EXACT_IDENTIFIER' : 'COHORT',
    };
  }
  const utah = queryLooksLikeUtah(originalQuestion);
  if (utah) {
    const identifier = utIdentifier(originalQuestion);
    const primaryHub = identifier?.hub ?? classifyUtHub(originalQuestion);
    const geo = parseNetworkAsk(originalQuestion).geography;
    const clarificationReason = utRefusal(originalQuestion)!;
    return {
      version: 'ask-research-plan-v1', originalQuestion,
      intent: utAmbiguousNumber(originalQuestion) ? 'ENTITY_LOOKUP_MISSING_IDENTITY' : utRankingAsked(originalQuestion) ? 'RECOMMENDATION_REQUEST' : identifier ? 'IDENTIFIER_LOOKUP' : primaryHub ? 'COHORT_BROWSE' : 'EXPLAINER',
      primaryHub, candidateHubs: primaryHub ? [primaryHub] : [],
      identifier: identifier ? { type: identifier.type, value: identifier.value, raw: identifier.raw } : undefined,
      normalizedGeography: geo,
      requestedGeography: geo?.stateCode ? { raw: geo.stateName!, display: geo.stateName!, kind: 'state', resolution: 'RESOLVED', stateCode: geo.stateCode, stateName: geo.stateName } : undefined,
      requestedEvidence: [], missingSlots: ['sourceOrScope'], executionAllowed: false, executionMode: 'CLARIFY',
      clarificationReason, reasonCodes: ['UTAH_SPECIALIST_HANDOFF', 'SPECIALIST_EXECUTION_BLOCKED'], legacyQueryType: identifier ? 'EXACT_IDENTIFIER' : 'COHORT',
    };
  }
  const okId=okIdentifier(originalQuestion);
  const oklahoma=queryLooksLikeOklahoma(originalQuestion);
  const okBlocked=okRefusal(originalQuestion);
  const okHub=okId?.hub??(oklahoma?classifyOkHub(originalQuestion):undefined);
  const okNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const okSeparateTask=Boolean(okId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!okSeparateTask&&(okId||okBlocked||(oklahoma&&!okNamed&&(okHub||/^(Oklahoma|OK)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:okAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':okRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':okId?'IDENTIFIER_LOOKUP':okHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:okHub,candidateHubs:okHub?[okHub]:[],identifier:okId?{type:okId.type,value:okId.value,raw:okId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:okBlocked?['sourceOrScope']:[],executionAllowed:!okBlocked&&Boolean(okHub),
      executionMode:okBlocked||!okHub?'CLARIFY':okId?'IDENTIFIER':'COHORT',
      clarificationReason:okBlocked??(!okHub?'Open /oklahoma for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[okId?'EXACT_IDENTIFIER_RECOGNIZED':'OKLAHOMA_RESEARCH_ROUTING',...(okBlocked?['OKLAHOMA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:okId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const moId=moIdentifier(originalQuestion);
  const missouri=queryLooksLikeMissouri(originalQuestion);
  const moBlocked=moRefusal(originalQuestion);
  const moHub=moId?.hub??(missouri?classifyMoHub(originalQuestion):undefined);
  const moNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const moSeparateTask=Boolean(moId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!moSeparateTask&&(moId||moBlocked||(missouri&&!moNamed&&(moHub||/^(Missouri|MO)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:moAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':moRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':moId?'IDENTIFIER_LOOKUP':moHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:moHub,candidateHubs:moHub?[moHub]:[],identifier:moId?{type:moId.type,value:moId.value,raw:moId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:moBlocked?['sourceOrScope']:[],executionAllowed:!moBlocked&&Boolean(moHub),
      executionMode:moBlocked||!moHub?'CLARIFY':moId?'IDENTIFIER':'COHORT',
      clarificationReason:moBlocked??(!moHub?'Open /missouri for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[moId?'EXACT_IDENTIFIER_RECOGNIZED':'MISSOURI_RESEARCH_ROUTING',...(moBlocked?['MISSOURI_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:moId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const neId=neIdentifier(originalQuestion);
  const nebraska=queryLooksLikeNebraska(originalQuestion);
  const neBlocked=neRefusal(originalQuestion);
  const neHub=neId?.hub??(nebraska?classifyNeHub(originalQuestion):undefined);
  if(neId||neBlocked||nebraska){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:neAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':neRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':neId?'IDENTIFIER_LOOKUP':neHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:neHub,candidateHubs:neHub?[neHub]:[],identifier:neId?{type:neId.type,value:neId.value,raw:neId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:['sourceOrScope'],executionAllowed:false,
      executionMode:'CLARIFY',
      clarificationReason:neBlocked??'Open /nebraska for six separate specialist research sources. No combined total.',
      reasonCodes:[neId?'EXACT_IDENTIFIER_RECOGNIZED':'NEBRASKA_RESEARCH_ROUTING','NEBRASKA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'],
      legacyQueryType:neId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const kansas=queryLooksLikeKansas(originalQuestion);
  const ksBlocked=ksRefusal(originalQuestion);
  if(kansas){
    const geo=parseNetworkAsk(originalQuestion).geography;
    const ksHub=classifyKsHub(originalQuestion);
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:ksRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':ksHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:ksHub,candidateHubs:ksHub?[ksHub]:[],
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:['sourceOrScope'],executionAllowed:false,
      executionMode:'CLARIFY',
      clarificationReason:ksBlocked??'Open /kansas for six separate specialist research sources. No combined total.',
      reasonCodes:['KANSAS_RESEARCH_ROUTING','KANSAS_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'],
      legacyQueryType:'COHORT'};
  }
  const iaId=iaIdentifier(originalQuestion);
  const iowa=queryLooksLikeIowa(originalQuestion);
  const iaBlocked=iaRefusal(originalQuestion);
  const iaHub=iaId?.hub??(iowa?classifyIaHub(originalQuestion):undefined);
  if(iaId||iaBlocked||iowa){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:iaAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':iaRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':iaId?'IDENTIFIER_LOOKUP':iaHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:iaHub,candidateHubs:iaHub?[iaHub]:[],identifier:iaId?{type:iaId.type,value:iaId.value,raw:iaId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:['sourceOrScope'],executionAllowed:false,
      executionMode:'CLARIFY',
      clarificationReason:iaBlocked??'Open /iowa for six separate specialist research sources. No combined total.',
      reasonCodes:[iaId?'EXACT_IDENTIFIER_RECOGNIZED':'IOWA_RESEARCH_ROUTING','IOWA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'],
      legacyQueryType:iaId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const idId=idIdentifier(originalQuestion);
  const idaho=queryLooksLikeIdaho(originalQuestion);
  const idBlocked=idRefusal(originalQuestion);
  const idHub=idId?.hub??(idaho?classifyIdHub(originalQuestion):undefined);
  if(idId||idBlocked||idaho){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:idAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':idRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':idId?'IDENTIFIER_LOOKUP':idHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:idHub,candidateHubs:idHub?[idHub]:[],identifier:idId?{type:idId.type,value:idId.value,raw:idId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:['sourceOrScope'],executionAllowed:false,
      executionMode:'CLARIFY',
      clarificationReason:idBlocked??'Open /idaho for six separate specialist research sources. No combined total.',
      reasonCodes:[idId?'EXACT_IDENTIFIER_RECOGNIZED':'IDAHO_RESEARCH_ROUTING','IDAHO_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'],
      legacyQueryType:idId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const wvId=wvIdentifier(originalQuestion);
  const westVirginia=queryLooksLikeWestVirginia(originalQuestion);
  const wvBlocked=wvRefusal(originalQuestion);
  const wvHub=wvId?.hub??(westVirginia?classifyWvHub(originalQuestion):undefined);
  if(wvId||wvBlocked||westVirginia){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:wvAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':wvRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':wvId?'IDENTIFIER_LOOKUP':wvHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:wvHub,candidateHubs:wvHub?[wvHub]:[],identifier:wvId?{type:wvId.type,value:wvId.value,raw:wvId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:['sourceOrScope'],executionAllowed:false,
      executionMode:'CLARIFY',
      clarificationReason:wvBlocked??'Open /west-virginia for six separate specialist research sources. No combined total.',
      reasonCodes:[wvId?'EXACT_IDENTIFIER_RECOGNIZED':'WEST_VIRGINIA_RESEARCH_ROUTING','WEST_VIRGINIA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'],
      legacyQueryType:wvId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const arId=arIdentifier(originalQuestion);
  const arkansas=queryLooksLikeArkansas(originalQuestion);
  const arBlocked=arRefusal(originalQuestion);
  const arHub=arId?.hub??(arkansas?classifyArHub(originalQuestion):undefined);
  const arNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const arSeparateTask=Boolean(arId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!arSeparateTask&&(arId||arBlocked||(arkansas&&!arNamed&&(arHub||/^(Arkansas|AR)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:arAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':arRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':arId?'IDENTIFIER_LOOKUP':arHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:arHub,candidateHubs:arHub?[arHub]:[],identifier:arId?{type:arId.type,value:arId.value,raw:arId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:arBlocked?['sourceOrScope']:[],executionAllowed:!arBlocked&&Boolean(arHub),
      executionMode:arBlocked||!arHub?'CLARIFY':arId?'IDENTIFIER':'COHORT',
      clarificationReason:arBlocked??(!arHub?'Open /arkansas for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[arId?'EXACT_IDENTIFIER_RECOGNIZED':'ARKANSAS_RESEARCH_ROUTING',...(arBlocked?['ARKANSAS_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:arId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const msId=msIdentifier(originalQuestion);
  const mississippi=queryLooksLikeMississippi(originalQuestion);
  const msBlocked=msRefusal(originalQuestion);
  const msHub=msId?.hub??(mississippi?classifyMsHub(originalQuestion):undefined);
  const msNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const msSeparateTask=Boolean(msId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!msSeparateTask&&(msId||msBlocked||(mississippi&&!msNamed&&(msHub||/^(Mississippi|MS)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:msAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':msRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':msId?'IDENTIFIER_LOOKUP':msHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:msHub,candidateHubs:msHub?[msHub]:[],identifier:msId?{type:msId.type,value:msId.value,raw:msId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:msBlocked?['sourceOrScope']:[],executionAllowed:!msBlocked&&Boolean(msHub),
      executionMode:msBlocked||!msHub?'CLARIFY':msId?'IDENTIFIER':'COHORT',
      clarificationReason:msBlocked??(!msHub?'Open /mississippi for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[msId?'EXACT_IDENTIFIER_RECOGNIZED':'MISSISSIPPI_RESEARCH_ROUTING',...(msBlocked?['MISSISSIPPI_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:msId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const scId=scIdentifier(originalQuestion);
  const southCarolina=queryLooksLikeSouthCarolina(originalQuestion);
  const scBlocked=scRefusal(originalQuestion);
  const scHub=scId?.hub??(southCarolina?classifyScHub(originalQuestion):undefined);
  const scNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const scSeparateTask=Boolean(scId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!scSeparateTask&&(scId||scBlocked||(southCarolina&&!scNamed&&(scHub||/^(South Carolina|SC)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:scAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':scRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':scId?'IDENTIFIER_LOOKUP':scHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:scHub,candidateHubs:scHub?[scHub]:[],identifier:scId?{type:scId.type,value:scId.value,raw:scId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:scBlocked?['sourceOrScope']:[],executionAllowed:!scBlocked&&Boolean(scHub),
      executionMode:scBlocked||!scHub?'CLARIFY':scId?'IDENTIFIER':'COHORT',
      clarificationReason:scBlocked??(!scHub?'Open /south-carolina for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[scId?'EXACT_IDENTIFIER_RECOGNIZED':'SOUTH_CAROLINA_RESEARCH_ROUTING',...(scBlocked?['SOUTH_CAROLINA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:scId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const alId=alIdentifier(originalQuestion);
  const alabama=queryLooksLikeAlabama(originalQuestion);
  const alBlocked=alRefusal(originalQuestion);
  const alHub=alId?.hub??(alabama?classifyAlHub(originalQuestion):undefined);
  const alNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const alSeparateTask=Boolean(alId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!alSeparateTask&&(alId||alBlocked||(alabama&&!alNamed&&(alHub||/^(Alabama|AL)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:alAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':alRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':alId?'IDENTIFIER_LOOKUP':alHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:alHub,candidateHubs:alHub?[alHub]:[],identifier:alId?{type:alId.type,value:alId.value,raw:alId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:alBlocked?['sourceOrScope']:[],executionAllowed:!alBlocked&&Boolean(alHub),
      executionMode:alBlocked||!alHub?'CLARIFY':alId?'IDENTIFIER':'COHORT',
      clarificationReason:alBlocked??(!alHub?'Open /alabama for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[alId?'EXACT_IDENTIFIER_RECOGNIZED':'ALABAMA_RESEARCH_ROUTING',...(alBlocked?['ALABAMA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:alId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const kyId=kyIdentifier(originalQuestion);
  const kentucky=queryLooksLikeKentucky(originalQuestion);
  const kyBlocked=kyRefusal(originalQuestion);
  const kyHub=kyId?.hub??(kentucky?classifyKyHub(originalQuestion):undefined);
  const kyNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const kySeparateTask=Boolean(kyId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!kySeparateTask&&(kyId||kyBlocked||(kentucky&&!kyNamed&&(kyHub||/^(Kentucky|KY)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:kyAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':kyRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':kyId?'IDENTIFIER_LOOKUP':kyHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:kyHub,candidateHubs:kyHub?[kyHub]:[],identifier:kyId?{type:kyId.type,value:kyId.value,raw:kyId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:kyBlocked?['sourceOrScope']:[],executionAllowed:!kyBlocked&&Boolean(kyHub),
      executionMode:kyBlocked||!kyHub?'CLARIFY':kyId?'IDENTIFIER':'COHORT',
      clarificationReason:kyBlocked??(!kyHub?'Open /kentucky for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[kyId?'EXACT_IDENTIFIER_RECOGNIZED':'KENTUCKY_RESEARCH_ROUTING',...(kyBlocked?['KENTUCKY_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:kyId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const laId=laIdentifier(originalQuestion);
  const louisiana=queryLooksLikeLouisiana(originalQuestion);
  const laBlocked=laRefusal(originalQuestion);
  const laHub=laId?.hub??(louisiana?classifyLaHub(originalQuestion):undefined);
  const laNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const laSeparateTask=Boolean(laId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!laSeparateTask&&(laId||laBlocked||(louisiana&&!laNamed&&(laHub||/^(Louisiana|LA)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:laAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':laRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':laId?'IDENTIFIER_LOOKUP':laHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:laHub,candidateHubs:laHub?[laHub]:[],identifier:laId?{type:laId.type,value:laId.value,raw:laId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:laBlocked?['sourceOrScope']:[],executionAllowed:!laBlocked&&Boolean(laHub),
      executionMode:laBlocked||!laHub?'CLARIFY':laId?'IDENTIFIER':'COHORT',
      clarificationReason:laBlocked??(!laHub?'Open /louisiana for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[laId?'EXACT_IDENTIFIER_RECOGNIZED':'LOUISIANA_RESEARCH_ROUTING',...(laBlocked?['LOUISIANA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:laId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const inId=inIdentifier(originalQuestion);
  const indiana=queryLooksLikeIndiana(originalQuestion);
  const inBlocked=inRefusal(originalQuestion);
  const inHub=inId?.hub??(indiana?classifyInHub(originalQuestion):undefined);
  const inNamed=/\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const inSeparateTask=Boolean(inId&&EXPLICIT_SECOND_TASK.test(originalQuestion));
  if(!inSeparateTask&&(inId||inBlocked||(indiana&&!inNamed&&(inHub||/^(Indiana|IN)( consumer research)?$/i.test(originalQuestion))))){
    const geo=parseNetworkAsk(originalQuestion).geography;
    return {version:'ask-research-plan-v1',originalQuestion,
      intent:inAmbiguousNumber(originalQuestion)?'ENTITY_LOOKUP_MISSING_IDENTITY':inRankingAsked(originalQuestion)?'RECOMMENDATION_REQUEST':inId?'IDENTIFIER_LOOKUP':inHub?'COHORT_BROWSE':'EXPLAINER',
      primaryHub:inHub,candidateHubs:inHub?[inHub]:[],identifier:inId?{type:inId.type,value:inId.value,raw:inId.raw}:undefined,
      normalizedGeography:geo,
      requestedGeography:geo?.stateCode?{raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city}:undefined,
      requestedEvidence:[],missingSlots:inBlocked?['sourceOrScope']:[],executionAllowed:!inBlocked&&Boolean(inHub),
      executionMode:inBlocked||!inHub?'CLARIFY':inId?'IDENTIFIER':'COHORT',
      clarificationReason:inBlocked??(!inHub?'Open /indiana for six separate specialist research sources. No combined total.':undefined),
      reasonCodes:[inId?'EXACT_IDENTIFIER_RECOGNIZED':'INDIANA_RESEARCH_ROUTING',...(inBlocked?['INDIANA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED']:[])],
      legacyQueryType:inId?'EXACT_IDENTIFIER':'COHORT'};
  }
  const wiId = wiIdentifier(originalQuestion);
  const wi = queryLooksLikeWisconsin(originalQuestion);
  const wiBlocked = wiRefusal(originalQuestion);
  const wiHub = wiId?.hub ?? (wi ? classifyWiHub(originalQuestion) : undefined);
  const wiNamed = /\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const wiSeparateTask = Boolean(wiId && EXPLICIT_SECOND_TASK.test(originalQuestion));
  if (!wiSeparateTask && (wiId || wiBlocked || (wi && !wiNamed && (wiHub || /^(Wisconsin|WI)( consumer research)?$/i.test(originalQuestion))))) {
    const geo = parseNetworkAsk(originalQuestion).geography;
    return {
      version: 'ask-research-plan-v1', originalQuestion,
      intent: wiAmbiguousNumber(originalQuestion) ? 'ENTITY_LOOKUP_MISSING_IDENTITY' : wiRankingAsked(originalQuestion) ? 'RECOMMENDATION_REQUEST' : wiId ? 'IDENTIFIER_LOOKUP' : wiHub ? 'COHORT_BROWSE' : 'EXPLAINER',
      primaryHub: wiHub, candidateHubs: wiHub ? [wiHub] : [],
      identifier: wiId ? {type:wiId.type,value:wiId.value,raw:wiId.raw} : undefined,
      normalizedGeography: geo,
      requestedGeography: geo?.stateCode ? {raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city} : undefined,
      requestedEvidence: [], missingSlots: wiBlocked ? ['sourceOrScope'] : [],
      executionAllowed: !wiBlocked && Boolean(wiHub), executionMode: wiBlocked || !wiHub ? 'CLARIFY' : wiId ? 'IDENTIFIER' : 'COHORT',
      clarificationReason: wiBlocked ?? (!wiHub ? 'Open /wisconsin for six separate specialist research sources. No combined total.' : undefined),
      reasonCodes: [wiId ? 'EXACT_IDENTIFIER_RECOGNIZED' : 'WISCONSIN_RESEARCH_ROUTING', ...(wiBlocked ? ['WISCONSIN_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'] : [])],
      legacyQueryType: wiId ? 'EXACT_IDENTIFIER' : 'COHORT',
    };
  }
  const mdId = mdIdentifier(originalQuestion);
  const md = queryLooksLikeMaryland(originalQuestion);
  const mdBlocked = mdRefusal(originalQuestion);
  const mdHub = mdId?.hub ?? (md ? classifyMdHub(originalQuestion) : undefined);
  const mdNamed = /\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const mdSeparateTask = Boolean(mdId && EXPLICIT_SECOND_TASK.test(originalQuestion));
  if (!mdSeparateTask && (mdId || mdBlocked || (md && !mdNamed && (mdHub || /^(Maryland|MD)( consumer research)?$/i.test(originalQuestion))))) {
    const geo = parseNetworkAsk(originalQuestion).geography;
    return {
      version: 'ask-research-plan-v1', originalQuestion,
      intent: mdAmbiguousNumber(originalQuestion) ? 'ENTITY_LOOKUP_MISSING_IDENTITY' : mdRankingAsked(originalQuestion) ? 'RECOMMENDATION_REQUEST' : mdId ? 'IDENTIFIER_LOOKUP' : mdHub ? 'COHORT_BROWSE' : 'EXPLAINER',
      primaryHub: mdHub, candidateHubs: mdHub ? [mdHub] : [],
      identifier: mdId ? {type:mdId.type,value:mdId.value,raw:mdId.raw} : undefined,
      normalizedGeography: geo,
      requestedGeography: geo?.stateCode ? {raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city} : undefined,
      requestedEvidence: [], missingSlots: mdBlocked ? ['sourceOrScope'] : [],
      executionAllowed: !mdBlocked && Boolean(mdHub), executionMode: mdBlocked || !mdHub ? 'CLARIFY' : mdId ? 'IDENTIFIER' : 'COHORT',
      clarificationReason: mdBlocked ?? (!mdHub ? 'Open /maryland for six separate specialist research sources. No combined total.' : undefined),
      reasonCodes: [mdId ? 'EXACT_IDENTIFIER_RECOGNIZED' : 'MARYLAND_RESEARCH_ROUTING', ...(mdBlocked ? ['MARYLAND_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'] : [])],
      legacyQueryType: mdId ? 'EXACT_IDENTIFIER' : 'COHORT',
    };
  }
  const ctId = ctIdentifier(originalQuestion);
  const ct = queryLooksLikeConnecticut(originalQuestion);
  const ctBlocked = ctRefusal(originalQuestion);
  const ctHub = ctId?.hub ?? (ct ? classifyCtHub(originalQuestion) : undefined);
  const ctNamed = /\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const ctSeparateTask = Boolean(ctId && EXPLICIT_SECOND_TASK.test(originalQuestion));
  if (!ctSeparateTask && (ctId || ctBlocked || (ct && !ctNamed && (ctHub || /^(Connecticut|CT)( consumer research)?$/i.test(originalQuestion))))) {
    const geo = parseNetworkAsk(originalQuestion).geography;
    return {
      version: 'ask-research-plan-v1', originalQuestion,
      intent: ctAmbiguousNumber(originalQuestion) ? 'ENTITY_LOOKUP_MISSING_IDENTITY' : ctRankingAsked(originalQuestion) ? 'RECOMMENDATION_REQUEST' : ctId ? 'IDENTIFIER_LOOKUP' : ctHub ? 'COHORT_BROWSE' : 'EXPLAINER',
      primaryHub: ctHub, candidateHubs: ctHub ? [ctHub] : [],
      identifier: ctId ? {type:ctId.type,value:ctId.value,raw:ctId.raw} : undefined,
      normalizedGeography: geo,
      requestedGeography: geo?.stateCode ? {raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city} : undefined,
      requestedEvidence: [], missingSlots: ctBlocked ? ['sourceOrScope'] : [],
      executionAllowed: !ctBlocked && Boolean(ctHub), executionMode: ctBlocked || !ctHub ? 'CLARIFY' : ctId ? 'IDENTIFIER' : 'COHORT',
      clarificationReason: ctBlocked ?? (!ctHub ? 'Open /connecticut for six separate specialist research sources. No combined total.' : undefined),
      reasonCodes: [ctId ? 'EXACT_IDENTIFIER_RECOGNIZED' : 'CONNECTICUT_RESEARCH_ROUTING', ...(ctBlocked ? ['CONNECTICUT_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'] : [])],
      legacyQueryType: ctId ? 'EXACT_IDENTIFIER' : 'COHORT',
    };
  }
  const miId = miIdentifier(originalQuestion);
  const mi = queryLooksLikeMichigan(originalQuestion);
  const miBlocked = miRefusal(originalQuestion);
  const miHub = miId?.hub ?? (mi ? classifyMiHub(originalQuestion) : undefined);
  const miNamed = /\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  const miSeparateTask = Boolean(miId && EXPLICIT_SECOND_TASK.test(originalQuestion));
  if (!miSeparateTask && (miId || miBlocked || (mi && !miNamed && (miHub || /^(Michigan|MI)( consumer research)?$/i.test(originalQuestion))))) {
    const geo = parseNetworkAsk(originalQuestion).geography;
    return {
      version: 'ask-research-plan-v1', originalQuestion,
      intent: miAmbiguousNumber(originalQuestion) ? 'ENTITY_LOOKUP_MISSING_IDENTITY' : miRankingAsked(originalQuestion) ? 'RECOMMENDATION_REQUEST' : miId ? 'IDENTIFIER_LOOKUP' : miHub ? 'COHORT_BROWSE' : 'EXPLAINER',
      primaryHub: miHub, candidateHubs: miHub ? [miHub] : [],
      identifier: miId ? {type:miId.type,value:miId.value,raw:miId.raw} : undefined,
      normalizedGeography: geo,
      requestedGeography: geo?.stateCode ? {raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city} : undefined,
      requestedEvidence: [], missingSlots: miBlocked ? ['sourceOrScope'] : [],
      executionAllowed: !miBlocked && Boolean(miHub), executionMode: miBlocked || !miHub ? 'CLARIFY' : miId ? 'IDENTIFIER' : 'COHORT',
      clarificationReason: miBlocked ?? (!miHub ? 'Open /michigan for six separate specialist research sources. No combined total.' : undefined),
      reasonCodes: [miId ? 'EXACT_IDENTIFIER_RECOGNIZED' : 'MICHIGAN_RESEARCH_ROUTING', ...(miBlocked ? ['MICHIGAN_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'] : [])],
      legacyQueryType: miId ? 'EXACT_IDENTIFIER' : 'COHORT',
    };
  }
  const mnId = mnIdentifier(originalQuestion);
  const mn = queryLooksLikeMinnesota(originalQuestion);
  const refusal = mnRefusal(originalQuestion);
  const mnHub = mnId?.hub ?? (mn ? classifyMnHub(originalQuestion) : undefined);
  const named = /\b(llc|inc|corp|named|called)\b|["']/i.test(originalQuestion);
  if (mnId || refusal || (mn && !named && (mnHub || /^(Minnesota|MN)( consumer research)?$/i.test(originalQuestion)))) {
    const geo = parseNetworkAsk(originalQuestion).geography;
    return {
      version: 'ask-research-plan-v1', originalQuestion,
      intent: mnAmbiguousNumber(originalQuestion) ? 'ENTITY_LOOKUP_MISSING_IDENTITY' : mnRankingAsked(originalQuestion) ? 'RECOMMENDATION_REQUEST' : mnId ? 'IDENTIFIER_LOOKUP' : mnHub ? 'COHORT_BROWSE' : 'EXPLAINER',
      primaryHub: mnHub, candidateHubs: mnHub ? [mnHub] : [],
      identifier: mnId ? {type:mnId.type,value:mnId.value,raw:mnId.raw} : undefined,
      normalizedGeography: geo,
      requestedGeography: geo?.stateCode ? {raw:geo.stateName!,display:geo.stateName!,kind:geo.city?'city':'state',resolution:'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,city:geo.city} : undefined,
      requestedEvidence: [], missingSlots: refusal ? ['sourceOrScope'] : [],
      executionAllowed: !refusal && Boolean(mnHub), executionMode: refusal || !mnHub ? 'CLARIFY' : mnId ? 'IDENTIFIER' : 'COHORT',
      clarificationReason: refusal ?? (!mnHub ? 'Open /minnesota for six separate specialist research sources. No combined total.' : undefined),
      reasonCodes: [mnId ? 'EXACT_IDENTIFIER_RECOGNIZED' : 'MINNESOTA_RESEARCH_ROUTING', ...(refusal ? ['MINNESOTA_SAFETY_REFUSAL','SPECIALIST_EXECUTION_BLOCKED'] : [])],
      legacyQueryType: mnId ? 'EXACT_IDENTIFIER' : 'COHORT',
    };
  }
  if (isUnsupportedSecuritiesAdviceQuery(originalQuestion)) {
    return {
      version: 'ask-research-plan-v1',
      originalQuestion,
      intent: 'RECOMMENDATION_REQUEST',
      primaryHub: 'investor',
      candidateHubs: ['investor'],
      requestedEvidence: [],
      missingSlots: [],
      executionAllowed: false,
      executionMode: 'CLARIFY',
      clarificationReason: investorFailClosedReason(originalQuestion),
      reasonCodes: ['UNSUPPORTED_SECURITIES_ADVICE', 'VALUE_JUDGMENT_REQUESTED', 'SPECIALIST_EXECUTION_BLOCKED'],
      legacyQueryType: 'COHORT',
    };
  }
  const parsed = parseNetworkAsk(originalQuestion);
  const candidateHubs = inferHubs(originalQuestion, parsed);
  const primaryHub = candidateHubs.length === 1 ? candidateHubs[0] : undefined;
  const entity = entityClass(originalQuestion, parsed);
  const geography = requestedGeography(originalQuestion, parsed);
  const identifier = parsed.identifier && !parsed.identifier.ambiguous ? {
    type: parsed.identifier.family.id,
    value: parsed.identifier.raw.match(/([A-Z0-9-]+)\s*$/i)?.[1] ?? parsed.identifier.raw,
    raw: parsed.identifier.raw,
  } : undefined;
  const reasons: string[] = [];
  let name = overrides.proposedEntityName ?? explicitEntityName(originalQuestion, entity, geography);
  let intent: AskResearchIntent;

  // TH-SEARCH-R1-018 BLOCKER-CROSS-01: a query that structurally requests 2+ specialist domains
  // joined by an explicit conjunction ("a mover AND a mortgage lender") must be routed to
  // MULTI_HUB_JOURNEY on that structural signal alone -- candidateHubs.length>1 combined with an
  // explicit conjunction word -- not just the pre-existing verb-shaped phrasings (buying/moving/
  // renting/etc.), which never matched noun-only requests like "a mover and a mortgage lender".
  // This intentionally does not special-case any single hub keyword (spec: "do not only add the
  // exact word 'mover' to one regex"); it relies on the planner's own hub detection, so it
  // generalizes to contractor+lender, insurance+lender, move+senior, etc. Single-hub queries
  // (company names such as "Rocket Mortgage" or "State Farm insurance company", or one domain
  // with merely contextual nouns from another) never reach candidateHubs.length>1 in the first
  // place, so they are unaffected regardless of any conjunction word present.
  const explicitMultiDomainConjunction = candidateHubs.length > 1 && /\b(?:and|plus|as well as)\b/i.test(originalQuestion);
  if (identifier) { intent = 'IDENTIFIER_LOOKUP'; reasons.push('EXACT_IDENTIFIER_RECOGNIZED'); }
  else if (explicitMultiDomainConjunction || (candidateHubs.length > 1 && /\b(?:buy(?:ing)?|purchas(?:e|ing)|rent(?:ing)?|mov(?:e|ing)|relocat(?:e|ing|ion)|roof\s+(?:is\s+)?damaged|damaged\s+roof|helping\s+(?:my\s+)?(?:mother|father|parent)|research\b.+\b(?:and|plus)\b)\b/i.test(originalQuestion)) || /\bmov(?:e|ing)\b[^?.!]{0,80}\b(?:buy(?:ing)?|purchas(?:e|ing)|rent(?:ing)?)\b/i.test(originalQuestion) || (/\bmov(?:e|ing)\b/i.test(originalQuestion)&&/\b(?:not sure|unsure)\b/i.test(originalQuestion)&&/\bbuy\b/i.test(originalQuestion)&&/\brent\b/i.test(originalQuestion))) { intent = 'MULTI_HUB_JOURNEY'; reasons.push('MULTIPLE_SPECIALIST_HUBS'); }
  else if (HOW_TO.test(originalQuestion)) { intent = 'HOW_TO'; reasons.push('HOW_TO_LANGUAGE'); }
  else if (STATUS_EXPLAINER.test(originalQuestion)) { intent = 'EXPLAINER'; reasons.push('STATUS_MEANING_QUESTION'); }
  else if (RECOMMENDATION.test(originalQuestion)) { intent = 'RECOMMENDATION_REQUEST'; reasons.push('VALUE_JUDGMENT_REQUESTED'); }
  else if (EXPLAINER.test(originalQuestion)) { intent = 'EXPLAINER'; reasons.push('EXPLAINER_LANGUAGE'); }
  else if (/\b(?:compare|versus|vs\.?|difference\s+between)\b/i.test(originalQuestion)) { intent = 'COMPARE'; reasons.push('COMPARISON_LANGUAGE'); }
  else if (DEICTIC_ENTITY.test(originalQuestion)) { intent = 'ENTITY_LOOKUP_MISSING_IDENTITY'; reasons.push('SPECIFIC_REFERENCE_WITHOUT_IDENTITY'); }
  else if (isInvestorAdviserSeekingQuery(originalQuestion)) { intent = 'COHORT_BROWSE'; reasons.push('ENTITY_CLASS_BROWSE'); }
  else if (name) { intent = 'ENTITY_LOOKUP'; reasons.push('EXPLICIT_IDENTITY_EVIDENCE'); }
  else if (entity && (geography || entity.id === 'auto_transport' || parsed.queryClassification.type === 'COHORT')) { intent = 'COHORT_BROWSE'; reasons.push('ENTITY_CLASS_BROWSE'); }
  else if (entity && /\b(?:which|show|find|list|need|licensed|active|registered)\b/i.test(originalQuestion)) { intent = 'COHORT_BROWSE'; reasons.push('ENTITY_CLASS_BROWSE'); }
  else { intent = 'ENTITY_LOOKUP_MISSING_IDENTITY'; reasons.push('IDENTITY_EVIDENCE_INSUFFICIENT'); }

  if (overrides.proposedIntent) intent = overrides.proposedIntent;

  const genericName = name && (entity && new RegExp(`^${entity.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(name) || /^(?:moving\s+company|mover|lender|insurance\s+agent|home\s+health\s+agency|nursing\s+home|contractor|roofer|financial\s+advis(?:er|or)|investment\s+advis(?:er|or))$/i.test(name));
  const geographyWords = geography?.display?.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((word) => word.length > 2) ?? [];
  const geographicName = name && geographyWords.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(name!));
  if (intent === 'ENTITY_LOOKUP' && (genericName || geographicName || !name)) {
    if (geographicName) reasons.push('IDENTITY_CONTRADICTS_GEOGRAPHY');
    else reasons.push('IDENTITY_EVIDENCE_FAILED_VALIDATION');
    name = undefined;
    intent = entity && geography ? 'COHORT_BROWSE' : 'ENTITY_LOOKUP_MISSING_IDENTITY';
  }

  const unresolvedGeography = Boolean(geography && geography.resolution === 'UNRESOLVED');
  const specificWithoutIdentity=DEICTIC_ENTITY.test(originalQuestion)&&!identifier&&!name;
  const executable = intent === 'IDENTIFIER_LOOKUP' || intent === 'ENTITY_LOOKUP' || intent === 'COHORT_BROWSE' && !unresolvedGeography || intent === 'RECOMMENDATION_REQUEST' && Boolean(primaryHub)&&!specificWithoutIdentity;
  const missingSlots = intent === 'ENTITY_LOOKUP_MISSING_IDENTITY'||specificWithoutIdentity ? [identifier ? 'entityName' : /\b(?:NMLS|USDOT|CRD|NPN|NAIC|CCN|number)\b/i.test(originalQuestion) ? 'identifierOrEntityName' : 'entityName'] : unresolvedGeography ? ['geography'] : [];
  if (unresolvedGeography) reasons.push('GEOGRAPHY_SCOPE_UNRESOLVED');
  if (!executable) reasons.push('SPECIALIST_EXECUTION_BLOCKED');
  const executionMode = executable ? intent === 'IDENTIFIER_LOOKUP' ? 'IDENTIFIER' : intent === 'ENTITY_LOOKUP' ? 'IDENTITY' : 'COHORT' : 'CLARIFY';
  const clarificationReason = unresolvedGeography ? `Confirm or narrow the requested geography (${geography?.display}) before specialist research runs.`
    : intent === 'ENTITY_LOOKUP_MISSING_IDENTITY' ? 'Provide the entity name or a recognized source identifier before specialist research runs.'
      : !executable ? 'This question needs explanation or scope clarification before specialist research can run.' : undefined;

  const plan:AskResearchPlan = {
    version: 'ask-research-plan-v1', originalQuestion, intent, primaryHub, candidateHubs,
    entityClass: entity, identifier, entityName: intent === 'ENTITY_LOOKUP' ? name : undefined,
    requestedGeography: geography,
    normalizedGeography: geography?.resolution === 'RESOLVED' ? parsed.geography : undefined,
    requestedEvidence: requestedEvidence(originalQuestion), missingSlots, executionAllowed: executable,
    executionMode, clarificationReason, reasonCodes: dedupe(reasons), legacyQueryType: legacyType(intent),
  };
  const care=careTask(originalQuestion);
  if(care?.kind==='care'&&!plan.entityName&&!/\b(?:CMS\s+)?CCN\s*#?\s*\d{6}\b/i.test(originalQuestion))return planCareResearch(plan,care.setting,careLocation(originalQuestion));
  if(care?.kind==='care_and_move')return {...plan,intent:'MULTI_HUB_JOURNEY',primaryHub:undefined,candidateHubs:['senior','move'],requestedGeography:careLocation(originalQuestion),executionAllowed:false,executionMode:'CLARIFY'};
  return plan;
}

export function validateAskResearchPlan(plan: AskResearchPlan): AskResearchPlan {
  return planAskResearch(plan.originalQuestion, { proposedIntent: plan.intent, proposedEntityName: plan.entityName });
}

export function planRequiresImmediateClarification(plan: AskResearchPlan): boolean {
  if (plan.executionAllowed) return false;
  return plan.reasonCodes.some((code) => [
    'HOW_TO_LANGUAGE', 'EXPLAINER_LANGUAGE', 'SPECIFIC_REFERENCE_WITHOUT_IDENTITY',
    'GEOGRAPHY_SCOPE_UNRESOLVED', 'IDENTITY_CONTRADICTS_GEOGRAPHY',
    'IDENTITY_EVIDENCE_FAILED_VALIDATION', 'MULTIPLE_SPECIALIST_HUBS',
    'UNSUPPORTED_SECURITIES_ADVICE', 'MINNESOTA_SAFETY_REFUSAL',
    'MICHIGAN_SAFETY_REFUSAL',
    'CONNECTICUT_SAFETY_REFUSAL',
  ].includes(code));
}
