/**
 * TH-SEARCH-R1-019A: the ONE authoritative decision for whether an Ask input is an unscoped
 * business/provider NAME candidate search. Page, API route and guided session all consult this;
 * nothing else decides it.
 *
 * It layers on the existing planner (it never rewrites the planner's protected outcomes):
 * identifiers, genuine cohort discovery, definitions/how-to, comparisons, journeys, care tasks and
 * deictic missing subjects keep their existing handling. What changes is that a supplied NAME no
 * longer needs a known hub, title case, two words, a legal suffix or a known brand to be searched.
 *
 * An inferred industry is a PRIORITIZATION HINT (priorityHubs), never an implicit hub filter. Only
 * a real user-selected hub, or an unambiguous "<category> named X" instruction, limits scope.
 */
import { planAskResearch, type AskResearchPlan } from '../research-planner.ts';
import { validateAskQuestion } from '../ask-request.ts';
import { isSpecialistHubId, type SpecialistHubId } from '../registry.ts';
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, type NameHubScope } from './contract.ts';

export type NameSearchBasis =
  | 'BARE_NAME'
  | 'PLANNER_ENTITY_NAME'
  | 'NAME_WITH_CATEGORY_WORD'
  | 'EXPLICIT_SCOPED_NAME';

export type NameCandidateDecision =
  | {
      operation: 'NAME_CANDIDATES';
      originalInput: string;
      name: string;
      hubScope: NameHubScope;
      priorityHubs: SpecialistHubId[];
      basis: NameSearchBasis;
      /**
       * True when the text could also be read as a category request. Candidates are shown first;
       * the existing cohort/guided path stays available and is used if no hub has a candidate.
       */
      alternateCohortInterpretation: boolean;
      unresolvedConditions: string[];
    }
  | { operation: 'NOT_NAME_SEARCH'; reason: string };

const not = (reason: string): NameCandidateDecision => ({ operation: 'NOT_NAME_SEARCH', reason });

/** Planner outcomes that are protected and must never be reinterpreted as a name. */
const PROTECTED_REASON_CODES = new Set([
  'EXACT_IDENTIFIER_RECOGNIZED', 'HOW_TO_LANGUAGE', 'EXPLAINER_LANGUAGE', 'STATUS_MEANING_QUESTION',
  'COMPARISON_LANGUAGE', 'MULTIPLE_SPECIALIST_HUBS', 'SPECIFIC_REFERENCE_WITHOUT_IDENTITY',
  'UNSUPPORTED_SECURITIES_ADVICE', 'CARE_TASK', 'IDENTITY_CONTRADICTS_GEOGRAPHY',
]);

const IDENTIFIER_LABEL = /\b(?:NAIC|CBC|CGC|CCC|CRD|NPN|NMLS|LEI|USDOT|DOT|MC|CCN)\b\s*#?\s*[A-Z0-9-]*\d/i;
/** A phrase LED by an identifier-family label ("NAIC ABCD") is a malformed identifier attempt, not a name -- mirrors the planner's own protection. */
const LEADING_IDENTIFIER_LABEL = /^(?:NAIC|CBC|CGC|CCC|CRD|NPN|NMLS|LEI|USDOT|DOT|MC|CCN)\b/i;
const SENTENCE_START = /^(?:show|find|list|which|what|who|whom|whose|where|when|why|how|is|are|was|were|does|do|did|can|could|should|would|will|i|i'm|im|we|my|need|looking|search|get|give|tell|help|compare|verify|check|research|look|please|any|are\s+there)\b/i;
const SENTENCE_ANYWHERE = /\b(?:near\s+me|in\s+my\s+area|for\s+me|i\s+need|i\s+want|do\s+i|should\s+i|can\s+i)\b/i;
const LOCATIVE = /\b(?:in|near|nearby|around|within|serving|headquartered|based\s+in|located\s+in)\b/i;
const PLACE_LENS = /^(?:what does trusthub know about|show (?:the )?place lens(?: for)?)\b/i;

/**
 * Industry/category vocabulary. A token listed here is NOT distinctive on its own -- but it is
 * preserved inside a supplied name ("Pure Moving Company" is searched whole, never stripped).
 */
const CATEGORY_TOKENS = new Set([
  'move', 'mover', 'movers', 'moving', 'relocation', 'relocations', 'van', 'lines', 'line', 'storage', 'transport', 'transportation', 'carrier', 'carriers', 'shipping', 'freight', 'logistics', 'hauling',
  'lender', 'lenders', 'lending', 'mortgage', 'mortgages', 'loan', 'loans', 'bank', 'banks', 'banking', 'credit', 'union', 'financial', 'finance', 'funding', 'capital',
  'insurance', 'insurer', 'insurers', 'agency', 'agencies', 'agent', 'agents', 'producer', 'producers', 'underwriters', 'underwriting', 'assurance',
  'contractor', 'contractors', 'contracting', 'construction', 'builder', 'builders', 'building', 'roofer', 'roofers', 'roofing', 'roof', 'plumber', 'plumbers', 'plumbing', 'electric', 'electrical', 'electrician', 'electricians', 'hvac', 'heating', 'cooling', 'air', 'conditioning', 'remodeling', 'handyman', 'locksmith', 'locksmiths',
  'senior', 'seniors', 'care', 'nursing', 'home', 'homes', 'health', 'hospice', 'facility', 'facilities', 'living', 'assisted', 'rehabilitation', 'rehab', 'center', 'centre', 'extended', 'skilled',
  'investor', 'investors', 'investment', 'investments', 'adviser', 'advisers', 'advisor', 'advisors', 'advisory', 'wealth', 'asset', 'assets', 'management', 'partners', 'ria', 'era',
  'company', 'companies', 'co', 'corp', 'corporation', 'inc', 'incorporated', 'llc', 'llp', 'lp', 'ltd', 'group', 'services', 'service', 'solutions', 'enterprises', 'associates', 'firm', 'firms', 'business', 'businesses', 'provider', 'providers',
]);

/** Qualifier/service descriptors -- words people use to describe a category, not to name a firm. */
const DESCRIPTOR_TOKENS = new Set([
  'licensed', 'active', 'registered', 'certified', 'insured', 'bonded', 'accredited', 'verified', 'approved', 'current', 'expired',
  'local', 'nearby', 'best', 'top', 'good', 'great', 'cheap', 'cheapest', 'affordable', 'reliable', 'trusted', 'trustworthy', 'safest', 'reputable', 'legitimate', 'recommended',
  'emergency', 'residential', 'commercial', 'industrial', 'office', 'apartment', 'interstate', 'intrastate', 'long', 'distance', 'cross', 'country', 'international', 'national',
  'piano', 'furniture', 'auto', 'car', 'cars', 'vehicle', 'vehicles', 'fha', 'va', 'usda', 'conventional', 'jumbo', 'refinance', 'refinancing', 'purchase', 'homeowners', 'renters', 'life', 'medicare', 'medicaid',
  'a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'with', 'by', 'on', 'at', 'my', 'me', 'some', 'all', 'new', 'small', 'big', 'large',
]);

export function nameTokens(value: string): string[] {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}

function geographyTokens(plan: AskResearchPlan): Set<string> {
  const geo = plan.requestedGeography;
  const words = [geo?.raw, geo?.display, geo?.city, geo?.county, geo?.stateName, geo?.stateCode].filter(Boolean).join(' ');
  return new Set(nameTokens(words));
}

/** Tokens that could only come from a specific business name, not a category description. */
export function distinctiveTokens(value: string, plan: AskResearchPlan): string[] {
  const geo = geographyTokens(plan);
  return nameTokens(value).filter((token) => !CATEGORY_TOKENS.has(token) && !DESCRIPTOR_TOKENS.has(token) && !geo.has(token));
}

function stripTerminalPunctuation(value: string): string {
  return value.replace(/[.!\s]+$/g, '').trim();
}

export function decideNameCandidateSearch(
  question: string,
  options: { plan?: AskResearchPlan; selectedHub?: string | null } = {},
): NameCandidateDecision {
  let original: string;
  try { original = validateAskQuestion(question); } catch { return not('INVALID_INPUT'); }
  const selectedHub: NameHubScope = options.selectedHub && isSpecialistHubId(options.selectedHub) ? options.selectedHub : 'all';
  const plan = options.plan ?? planAskResearch(original);

  if (PLACE_LENS.test(original)) return not('PLACE_LENS');
  if (plan.identifier || IDENTIFIER_LABEL.test(original)) return not('IDENTIFIER_PATH_PROTECTED');
  if (/^[\d\s#-]+$/.test(original)) return not('BARE_DIGITS_ARE_IDENTIFIER_INPUT');
  if (LEADING_IDENTIFIER_LABEL.test(original)) return not('MALFORMED_IDENTIFIER_ATTEMPT_PROTECTED');
  for (const code of plan.reasonCodes) if (PROTECTED_REASON_CODES.has(code)) return not(`PLANNER_PROTECTED:${code}`);
  if (plan.intent === 'MULTI_HUB_JOURNEY' || plan.intent === 'HOW_TO' || plan.intent === 'EXPLAINER' || plan.intent === 'COMPARE') return not(`PLANNER_INTENT:${plan.intent}`);

  // Unambiguous instruction: "<category> named X" / "companies called X". The category limits
  // scope ONLY in this explicit form (or via a user-selected hub) -- never from a name's own words.
  const introduced = original.match(/\b(?:named|called)\s+["“]?(.+?)["”]?(?=[?.!,]|$)/i)?.[1]?.trim();
  if (introduced && introduced.length >= NAME_MIN_LENGTH && introduced.length <= NAME_MAX_LENGTH && distinctiveTokens(introduced, plan).length) {
    const scoped: NameHubScope = selectedHub !== 'all' ? selectedHub : plan.entityClass && plan.primaryHub ? plan.primaryHub : 'all';
    return { operation: 'NAME_CANDIDATES', originalInput: original, name: introduced, hubScope: scoped, priorityHubs: plan.candidateHubs, basis: 'EXPLICIT_SCOPED_NAME', alternateCohortInterpretation: false, unresolvedConditions: [] };
  }

  if (original.includes('?')) return not('QUESTION_SENTENCE');
  if (plan.requestedEvidence.length) return not('EVIDENCE_REQUEST_KEEPS_EXISTING_PATH');
  const quoted = original.match(/^["“]([^"”]{2,160})["”]$/)?.[1]?.trim();
  const name = stripTerminalPunctuation(quoted ?? original);
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) return not('NAME_LENGTH_OUT_OF_BOUNDS');
  const tokens = nameTokens(name);
  if (!tokens.length || tokens.length > 10) return not('NOT_NAME_SHAPED');
  if (!quoted && (SENTENCE_START.test(name) || SENTENCE_ANYWHERE.test(name))) return not('SENTENCE_NOT_NAME');
  if (!quoted && LOCATIVE.test(name)) return not('LOCATIVE_PHRASE_IS_DISCOVERY');

  const distinctive = distinctiveTokens(name, plan);
  if (!distinctive.length) return not('CATEGORY_OR_GEOGRAPHY_WORDS_ONLY');

  const base = { operation: 'NAME_CANDIDATES' as const, originalInput: original, name, hubScope: selectedHub, priorityHubs: plan.candidateHubs, unresolvedConditions: [] as string[] };

  // The planner already captured this whole input as an entity name. Previously that capture was
  // discarded whenever the hub was unknown ("Allied Van Lines", "Abbey Delray South").
  if (plan.intent === 'ENTITY_LOOKUP' && plan.entityName && stripTerminalPunctuation(plan.entityName).toLowerCase() === name.toLowerCase()) {
    return { ...base, basis: 'PLANNER_ENTITY_NAME', alternateCohortInterpretation: false };
  }
  const valueJudgment = plan.reasonCodes.includes('VALUE_JUDGMENT_REQUESTED');
  if (!plan.entityClass && !plan.requestedGeography && !valueJudgment) {
    return { ...base, basis: 'BARE_NAME', alternateCohortInterpretation: false };
  }
  // A name that merely CONTAINS an industry/value/place word ("Pure Moving Company", "Good Greek
  // Moving"). Search the supplied name whole, network-wide; keep the category reading available.
  return { ...base, basis: 'NAME_WITH_CATEGORY_WORD', alternateCohortInterpretation: true };
}
