import { parseNetworkAsk, type ParsedGeography } from './ask-parse.ts';
import type { SpecialistHubId } from './registry.ts';
import type { UniversalQueryType } from './query-classification.ts';
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
  version: 'ask-research-plan-v1';
  originalQuestion: string;
  intent: AskResearchIntent;
  primaryHub?: SpecialistHubId;
  candidateHubs: SpecialistHubId[];
  entityClass?: { id: string; label: string };
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

const HOW_TO = /\b(?:how\s+(?:do|can|should|would)\s+i|how\s+to|what\s+should\s+i\s+(?:look|read|check)|ways?\s+to)\b/i;
const EXPLAINER = /\b(?:what\s+(?:is|are|does)|define|definition|explain|difference\s+between|what\s+do\s+.+\s+mean)\b/i;
const RECOMMENDATION = /\b(?:best|safest|most\s+trustworthy|legitimate|recommended|top|good)\b/i;
const DEICTIC_ENTITY = /\b(?:this|that)\s+(?:company|firm|facility|agency|contractor|mover|moving\s+company|lender|advis(?:er|or)|financial\s+advis(?:er|or)|investment\s+advis(?:er|or)|agent|insurance\s+agent|guy|home\s+health\s+agency)\b|\bmy\s+(?:company|contractor|mover|moving\s+company|lender|advis(?:er|or)|agent|agency)\b/i;

function dedupe<T>(values: T[]): T[] { return [...new Set(values)]; }

function inferHubs(query: string, parsed: ReturnType<typeof parseNetworkAsk>): SpecialistHubId[] {
  const hubs = [...parsed.suggestedHubs];
  const patterns: Array<[SpecialistHubId, RegExp]> = [
    ['move', /\b(?:move(?:r|rs)?|moving\s+compan(?:y|ies)|USDOT|\bMC\b|carrier|ship\s+(?:my|a)\s+(?:car|vehicle))\b/i],
    ['lender', /\b(?:lender|mortgage|NMLS|LEI|HMDA|loan\s+estimate|loan\s+officer)\b/i],
    ['insurance', /\b(?:insurance|insurer|NPN|NAIC|producer)\b/i],
    ['senior', /\b(?:nursing\s+home|home\s+health|hospice|CMS|Medicare|star\s+ratings?)\b/i],
    ['contractor', /\b(?:contractor|roofer|roof(?:ing)?(?:\s+guy)?|HVAC|electrician|plumber|locksmith|hearth|telecom|mechanical)\b/i],
    ['investor', /\b(?:financial\s+advis(?:er|or)|investment\s+advis(?:er|or)|RIA|ERA|CRD|SEC|Form\s+ADV|IARD)\b/i],
  ];
  for (const [hub, pattern] of patterns) if (pattern.test(query)) hubs.push(hub);
  return dedupe(hubs);
}

function entityClass(query: string, parsed: ReturnType<typeof parseNetworkAsk>): AskResearchPlan['entityClass'] {
  const classified = parsed.queryClassification.entityClass;
  if (classified) return { id: classified.id, label: classified.label };
  if (parsed.seniorProviderClass) return { id: parsed.seniorProviderClass, label: parsed.seniorProviderClass.replaceAll('_', ' ') };
  if (/\b(?:moving\s+compan(?:y|ies)|movers?)\b/i.test(query)) return { id: 'mover', label: 'Moving company' };
  if (/\b(?:roofers?|roof(?:ing)?\s+(?:contractors?|guy))\b/i.test(query)) return { id: 'roofing_contractor', label: 'Roofing contractor' };
  if (/\bcontractors?\b/i.test(query)) return { id: 'contractor', label: 'Contractor' };
  if (/\b(?:locksmiths?|hearth\s+specialists?|telecom(?:munications?)?|mechanical)\b/i.test(query)) return { id: 'contractor', label: 'Contractor' };
  if (/\b(?:auto\s+transport|ship\s+(?:my|a)\s+(?:car|vehicle)|transport\s+my\s+(?:car|vehicle))\b/i.test(query)) return { id: 'auto_transport', label: 'Auto transport company' };
  if (/\b(?:mortgage\s+)?lenders?\b/i.test(query)) return { id: 'mortgage_lender', label: 'Mortgage lender' };
  if (/\b(?:HMDA|originations?|applications?|denials?|\bFHA\b|\bVA\b|\bUSDA\b)\b/i.test(query) && parsed.suggestedHubs.includes('lender')) return { id: 'hmda_reporting_institution', label: 'HMDA reporting institution' };
  if (/\b(?:financial|investment)\s+advis(?:er|or)s?\b/i.test(query)) return { id: 'investment_adviser', label: 'Investment adviser' };
  if (/\binsurance\s+agents?\b/i.test(query)) return { id: 'insurance_producer', label: 'Insurance producer' };
  if (/\binsurance\s+compan(?:y|ies)\b/i.test(query)) return { id: 'legal_insurer', label: 'Legal insurer' };
  if (/\bhome\s+health(?:\s+agency)?\b/i.test(query)) return { id: 'home_health', label: 'Home Health' };
  return undefined;
}

function title(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requestedGeography(query: string, parsed: ReturnType<typeof parseNetworkAsk>): AskRequestedGeography | undefined {
  const route=query.match(/\bfrom\s+([a-z][a-z .'-]{1,40}?)\s+to\s+([a-z][a-z .'-]{1,40}?)(?=[?,.!]|\s+who\b|$)/i);
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
    [/\bboca\b/i, 'Boca', 'place', 'UNRESOLVED'],
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
    const match = query.match(/\b(?:in|near|around|within)\s+([a-z][a-z .'-]*?(?:county)?(?:\s*,?\s*(?:florida|texas|california|new\s+jersey|fl|tx|ca|nj))?)\b(?=\s+(?:for|and|with|that|which)\b|[?.!,]|$)/i);
    const raw = match?.[1]?.trim() ?? geo.countyName ?? geo.city ?? geo.stateName ?? geo.stateCode!;
    const display = geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.city ? `${geo.city}, ${geo.stateName}` : geo.stateName!;
    return { raw, display, kind: geo.countyName ? 'county' : geo.city ? 'city' : 'state', resolution: 'RESOLVED',stateCode:geo.stateCode,stateName:geo.stateName,county:geo.countyName?.replace(/ County$/i,''),city:geo.city };
  }
  const loose = query.match(/\b(?:in|near|around|within)\s+([a-z][a-z .'-]{1,45}?)(?=\s+(?:for|and|with|that|which)\b|[?.!,]|$)/i);
  if (loose?.[1] && !/^(?:me|here)$/i.test(loose[1].trim())) return { raw: loose[1].trim(), display: title(loose[1].trim()), kind: 'place', resolution: 'UNRESOLVED' };
  return undefined;
}

function explicitEntityName(query: string, entity: AskResearchPlan['entityClass'], geography: AskRequestedGeography | undefined): string | undefined {
  const quoted = query.match(/["“]([^"”]{2,160})["”]/)?.[1]?.trim();
  if (quoted) return quoted;
  const introduced = query.match(/\b(?:named|called)\s+(.+?)(?=[?.!,]|$)/i)?.[1]?.trim();
  if (introduced) return introduced;
  const evidenceSubject = query.match(/\b(?:complaints?\s+(?:about|against)|research|look\s+up|check)\s+([a-z0-9&.' -]+?)(?=[?.!,]|$)/i)?.[1]?.trim();
  if (evidenceSubject && !/^(?:a|an|the|this|that|my)\b/i.test(evidenceSubject)) return evidenceSubject;
  if (/\b(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|LLP|L\.P\.)\b/i.test(query)) return query.replace(/[?.!]+$/g, '').trim();
  if (!entity && /^[A-Z][A-Z0-9&.-]{2,40}$/.test(query.trim())) return query.trim();
  if (entity && !geography && !/\b(?:in|near|around|within|how|which|what|is\s+this|is\s+my|show|find|need)\b/i.test(query)) {
    const residue = query.replace(new RegExp(entity.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ').replace(/\b(?:moving\s+company|movers?|contractors?|lenders?|nursing\s+homes?)\b/gi, ' ').replace(/[^a-z0-9&]+/gi, ' ').trim();
    if (residue.split(/\s+/).length >= 2) return query.replace(/[?.!]+$/g, '').trim();
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

  if (identifier) { intent = 'IDENTIFIER_LOOKUP'; reasons.push('EXACT_IDENTIFIER_RECOGNIZED'); }
  else if (parsed.intent === 'journey' || candidateHubs.length > 1 && /\b(?:and|,).*(?:lender|insurance|contractor|mover|care|advis)/i.test(originalQuestion)) { intent = 'MULTI_HUB_JOURNEY'; reasons.push('MULTIPLE_SPECIALIST_HUBS'); }
  else if (HOW_TO.test(originalQuestion)) { intent = 'HOW_TO'; reasons.push('HOW_TO_LANGUAGE'); }
  else if (RECOMMENDATION.test(originalQuestion)) { intent = 'RECOMMENDATION_REQUEST'; reasons.push('VALUE_JUDGMENT_REQUESTED'); }
  else if (EXPLAINER.test(originalQuestion)) { intent = 'EXPLAINER'; reasons.push('EXPLAINER_LANGUAGE'); }
  else if (/\b(?:compare|versus|vs\.?|difference\s+between)\b/i.test(originalQuestion)) { intent = 'COMPARE'; reasons.push('COMPARISON_LANGUAGE'); }
  else if (DEICTIC_ENTITY.test(originalQuestion)) { intent = 'ENTITY_LOOKUP_MISSING_IDENTITY'; reasons.push('SPECIFIC_REFERENCE_WITHOUT_IDENTITY'); }
  else if (name) { intent = 'ENTITY_LOOKUP'; reasons.push('EXPLICIT_IDENTITY_EVIDENCE'); }
  else if (entity && (geography || entity.id === 'auto_transport' || parsed.queryClassification.type === 'COHORT')) { intent = 'COHORT_BROWSE'; reasons.push('ENTITY_CLASS_BROWSE'); }
  else if (entity && /\b(?:which|show|find|list|need|licensed|active|registered)\b/i.test(originalQuestion)) { intent = 'COHORT_BROWSE'; reasons.push('ENTITY_CLASS_BROWSE'); }
  else { intent = 'ENTITY_LOOKUP_MISSING_IDENTITY'; reasons.push('IDENTITY_EVIDENCE_INSUFFICIENT'); }

  if (overrides.proposedIntent) intent = overrides.proposedIntent;

  const genericName = name && (entity && new RegExp(`^${entity.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(name) || /^(?:moving\s+company|mover|lender|insurance\s+agent|home\s+health\s+agency|nursing\s+home|contractor|roofer|financial\s+advis(?:er|or)|investment\s+advis(?:er|or))$/i.test(name));
  const geographyWords = geography?.display.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((word) => word.length > 2) ?? [];
  const geographicName = name && geographyWords.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(name!));
  if (intent === 'ENTITY_LOOKUP' && (genericName || geographicName || !name)) {
    if (geographicName) reasons.push('IDENTITY_CONTRADICTS_GEOGRAPHY');
    else reasons.push('IDENTITY_EVIDENCE_FAILED_VALIDATION');
    name = undefined;
    intent = entity && geography ? 'COHORT_BROWSE' : 'ENTITY_LOOKUP_MISSING_IDENTITY';
  }

  const unresolvedGeography = Boolean(geography && geography.resolution === 'UNRESOLVED');
  const executable = intent === 'IDENTIFIER_LOOKUP' || intent === 'ENTITY_LOOKUP' || intent === 'COHORT_BROWSE' && !unresolvedGeography || intent === 'RECOMMENDATION_REQUEST' && Boolean(primaryHub);
  const missingSlots = intent === 'ENTITY_LOOKUP_MISSING_IDENTITY' ? [identifier ? 'entityName' : /\b(?:NMLS|USDOT|CRD|NPN|NAIC|CCN|number)\b/i.test(originalQuestion) ? 'identifierOrEntityName' : 'entityName'] : unresolvedGeography ? ['geography'] : [];
  if (unresolvedGeography) reasons.push('GEOGRAPHY_SCOPE_UNRESOLVED');
  if (!executable) reasons.push('SPECIALIST_EXECUTION_BLOCKED');
  const executionMode = executable ? intent === 'IDENTIFIER_LOOKUP' ? 'IDENTIFIER' : intent === 'ENTITY_LOOKUP' ? 'IDENTITY' : 'COHORT' : 'CLARIFY';
  const clarificationReason = unresolvedGeography ? `Confirm or narrow the requested geography (${geography?.display}) before specialist research runs.`
    : intent === 'ENTITY_LOOKUP_MISSING_IDENTITY' ? 'Provide the entity name or a recognized source identifier before specialist research runs.'
      : !executable ? 'This question needs explanation or scope clarification before specialist research can run.' : undefined;

  return {
    version: 'ask-research-plan-v1', originalQuestion, intent, primaryHub, candidateHubs,
    entityClass: entity, identifier, entityName: intent === 'ENTITY_LOOKUP' ? name : undefined,
    requestedGeography: geography,
    normalizedGeography: geography?.resolution === 'RESOLVED' ? parsed.geography : undefined,
    requestedEvidence: requestedEvidence(originalQuestion), missingSlots, executionAllowed: executable,
    executionMode, clarificationReason, reasonCodes: dedupe(reasons), legacyQueryType: legacyType(intent),
  };
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
  ].includes(code));
}
