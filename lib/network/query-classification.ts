import type { SpecialistHubId } from './registry.ts';

export const UNIVERSAL_QUERY_TYPES = [
  'EXACT_IDENTIFIER',
  'IDENTITY_NAME',
  'COHORT',
  'MISSING_SLOTS',
  'LIFE_SITUATION',
  'EVIDENCE_QUERY',
  'DEFINITION',
  'UNSUPPORTED',
] as const;

export type UniversalQueryType = (typeof UNIVERSAL_QUERY_TYPES)[number];

export type GenericEntityClass = {
  id: string;
  hubId: SpecialistHubId;
  label: string;
  matchedText: string;
  pluralOrCollective: boolean;
};

export type UniversalQueryClassification = {
  type: UniversalQueryType;
  entityClass?: GenericEntityClass;
  residualName?: string;
  consumed: string[];
};

type ClassDefinition = Omit<GenericEntityClass, 'matchedText' | 'pluralOrCollective'> & { pattern: RegExp };

const ENTITY_CLASSES: ClassDefinition[] = [
  { id: 'auto_transport', hubId: 'move', label: 'Auto transport company', pattern: /\b(?:auto|vehicle|car)\s+(?:transport(?:er)?|shipping)\s*(?:compan(?:y|ies)|carriers?|brokers?|transporters?)?\b/i },
  { id: 'household_goods_carrier', hubId: 'move', label: 'Household-goods carrier', pattern: /\bhousehold[- ]goods\s+(?:motor\s+)?carriers?\b/i },
  { id: 'mover', hubId: 'move', label: 'Moving company', pattern: /\b(?:moving\s+compan(?:y|ies)|movers?)\b/i },
  { id: 'mortgage_lender', hubId: 'lender', label: 'Mortgage lender', pattern: /\b(?:mortgage\s+(?:lenders?|compan(?:y|ies))|lenders?)\b/i },
  { id: 'insurance_agency', hubId: 'insurance', label: 'Insurance agency', pattern: /\binsurance\s+agenc(?:y|ies)\b/i },
  { id: 'legal_insurer', hubId: 'insurance', label: 'Legal insurer', pattern: /\b(?:legal\s+insurers?|insurance\s+(?:compan(?:y|ies)|carriers?)|insurers?)\b/i },
  { id: 'insurance_producer', hubId: 'insurance', label: 'Insurance producer', pattern: /\b(?:insurance\s+agents?|insurance\s+producers?|producers?)\b/i },
  { id: 'nursing_home', hubId: 'senior', label: 'Nursing Home', pattern: /\bnursing\s+homes?\b/i },
  { id: 'home_health', hubId: 'senior', label: 'Home Health', pattern: /\bhome\s+health(?:\s+(?:agenc(?:y|ies)|providers?))?\b/i },
  { id: 'hospice', hubId: 'senior', label: 'Hospice', pattern: /\bhospice(?:s|\s+providers?)?\b/i },
  { id: 'roofing_contractor', hubId: 'contractor', label: 'Roofing contractor', pattern: /\b(?:roofing\s+contractors?|roofers?)\b/i },
  { id: 'electrical_contractor', hubId: 'contractor', label: 'Electrical contractor', pattern: /\b(?:electrical\s+contractors?|electricians?)\b/i },
  { id: 'hvac_contractor', hubId: 'contractor', label: 'HVAC contractor', pattern: /\b(?:hvac(?:\s+contractors?)?)\b/i },
  { id: 'plumbing_contractor', hubId: 'contractor', label: 'Plumbing contractor', pattern: /\b(?:plumbing\s+contractors?|plumbers?)\b/i },
  { id: 'general_contractor', hubId: 'contractor', label: 'General contractor', pattern: /\bgeneral\s+contractors?\b/i },
  { id: 'contractor', hubId: 'contractor', label: 'Contractor', pattern: /\bcontractors?\b/i },
  { id: 'ria', hubId: 'investor', label: 'RIA firm', pattern: /\b(?:registered\s+investment\s+advisers?|rias?)\b/i },
  { id: 'era', hubId: 'investor', label: 'ERA firm', pattern: /\b(?:exempt\s+reporting\s+advisers?|eras?)\b/i },
  { id: 'investment_adviser', hubId: 'investor', label: 'Investment-adviser firm', pattern: /\b(?:investment\s+advis(?:er|or)s?|investment\s+compan(?:y|ies)|advisory\s+firms?)\b/i },
];

function classMatch(query: string): GenericEntityClass | undefined {
  for (const row of ENTITY_CLASSES) {
    const match = query.match(row.pattern);
    if (!match) continue;
    return {
      id: row.id,
      hubId: row.hubId,
      label: row.label,
      matchedText: match[0],
      pluralOrCollective: /(?:ies|ers|ors|homes|firms|agencies|companies|lenders|movers|roofers|electricians|plumbers|providers)\b/i.test(match[0]),
    };
  }
  return undefined;
}

function removeOnce(value: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return value.replace(new RegExp(`\\b${escaped}\\b`, 'i'), ' ');
}

function hasExplicitIdentityEvidence(query: string, residual: string, hasEntityClass: boolean, hasGeography: boolean): boolean {
  if (/\b(?:named|called)\s+[^?.!,]+/i.test(query) || /["“][^"”]+["”]/.test(query)) return true;
  if (/\b(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|LLP|L\.P\.)\b/i.test(query)) return true;
  if (hasEntityClass && /(?:^|\b(?:is|about|check|research|find)\s+)(?:[a-z0-9&.'-]+\s+){2,5}(?:movers?|moving\s+compan(?:y|ies)|contractors?|lenders?|agenc(?:y|ies)|advis(?:er|or)s?)\b/i.test(query)) return true;
  if (!hasEntityClass && /^[A-Z][A-Z0-9&.-]{2,40}$/.test(query.trim())) return true;
  if (!hasEntityClass && !hasGeography && !/\b(?:how|what|which|where|when|why|show|list|need|licensed|active|registered|best|top|safest|recommended)\b/i.test(query) && query.trim().split(/\s+/).length >= 2) return true;
  if (hasGeography || /\b(?:in|near|around|within)\b/i.test(query)) return false;
  return hasEntityClass && residual.split(/\s+/).filter(Boolean).length >= 2;
}

export function classifyUniversalQuery(input: {
  query: string;
  exactIdentifier: boolean;
  ambiguousIdentifier?: boolean;
  suggestedHubs: SpecialistHubId[];
  geography?: { stateCode?: string; stateName?: string; countyName?: string; city?: string };
  intentHint?: string;
}): UniversalQueryClassification {
  const query = input.query.trim();
  if (input.exactIdentifier) return { type: 'EXACT_IDENTIFIER', consumed: ['regulatory identifier'] };
  if (input.ambiguousIdentifier) return { type: 'UNSUPPORTED', consumed: [] };
  if (input.intentHint === 'journey') return { type: 'LIFE_SITUATION', consumed: [] };
  if (/\b(?:what is|what does|define|definition|difference between|mean)\b/i.test(query)) return { type: 'DEFINITION', consumed: [] };

  const entityClass = classMatch(query);
  let residual = query;
  const consumed: string[] = [];
  if (entityClass) {
    residual = removeOnce(residual, entityClass.matchedText);
    consumed.push(entityClass.matchedText);
  }
  const geographyTerms = [
    input.geography?.countyName,
    input.geography?.countyName?.replace(/\s+County$/i, ''),
    input.geography?.city,
    input.geography?.stateName,
    input.geography?.stateCode,
  ];
  for (const term of geographyTerms) {
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (!new RegExp(`\\b${escaped}\\b`, 'i').test(residual)) continue;
    residual = removeOnce(residual, term);
    consumed.push(term);
  }
  residual = residual
    .replace(/[?!.,:;#]/g, ' ')
    .replace(/\b(?:show|list|find|search|look up|research|tell me about|please|the|a|an|in|near|around|within|of|for|located|based|headquartered|active|current|licensed|credentialed|reporting|best|top|safest|recommended|cheap|cheapest|most trustworthy)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/\b(?:inspection|examination|enforcement|discipline|complaint|ownership|authority|regulatory history|evidence|filing|raum|hmda)\b/i.test(query) && entityClass) {
    return { type: 'EVIDENCE_QUERY', entityClass, residualName: residual || undefined, consumed };
  }
  if (entityClass && input.geography && !residual) return { type: 'COHORT', entityClass, consumed };
  if (entityClass && !residual && (entityClass.pluralOrCollective || entityClass.id === 'auto_transport')) {
    return { type: 'COHORT', entityClass, consumed };
  }
  if (entityClass && !residual) return { type: 'MISSING_SLOTS', entityClass, consumed };
  if (residual && input.suggestedHubs.length === 1 && hasExplicitIdentityEvidence(query, residual, Boolean(entityClass), Boolean(input.geography))) {
    return { type: 'IDENTITY_NAME', entityClass, residualName: residual, consumed };
  }
  if (entityClass) return { type: 'COHORT', entityClass, residualName: residual || undefined, consumed };
  if (input.suggestedHubs.length === 1 && hasExplicitIdentityEvidence(query, query, false, Boolean(input.geography))) {
    return { type: 'IDENTITY_NAME', residualName: query, consumed };
  }
  return { type: 'UNSUPPORTED', consumed };
}
