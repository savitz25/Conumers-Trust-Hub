import type { ParsedNetworkAsk } from './ask-parse.ts';

export const ASK_RESULT_CLASSES = ['EXACT_IDENTITY', 'AMBIGUOUS_IDENTITIES', 'RESEARCH_COHORT', 'MARKET_OR_PLACE_RESEARCH', 'HANDOFF', 'NO_CONFIDENT_MATCH', 'UNSUPPORTED_QUERY'] as const;
export type AskResultClass = (typeof ASK_RESULT_CLASSES)[number];

export const IDENTITY_RESOLUTION_CLASSES = ['EXACT_IDENTIFIER', 'EXACT_CANONICAL_NAME', 'EXACT_PUBLIC_NAME', 'NORMALIZED_NAME', 'AMBIGUOUS_NAME', 'FUZZY_CANDIDATES', 'NO_CONFIDENT_MATCH'] as const;
export type IdentityResolutionClass = (typeof IDENTITY_RESOLUTION_CLASSES)[number];

/** Detects identity intent only. Identity resolution remains specialist-owned. */
export function isSpecificIdentityRequest(parsed: ParsedNetworkAsk): boolean {
  return parsed.queryClassification.type === 'EXACT_IDENTIFIER' || parsed.queryClassification.type === 'IDENTITY_NAME';
}

export function requestedIdentityName(parsed: ParsedNetworkAsk): string {
  return (parsed.nameQuery || parsed.query)
    .replace(/^(?:is|find|search|look up|check|verify)\s+/i, '')
    .replace(/\s+(?:a\s+)?(?:legitimate|licensed|authorized).*$/i, '')
    .replace(/[?.!]+$/g, '').trim();
}

export type AskDiagnostics = {
  interpretedIntent: string; selectedHubs: string[]; resultClass: AskResultClass;
  identityResolutionClass?: IdentityResolutionClass; capabilityUsed: string[];
  fallbackPath: 'none' | 'specialist_handoff' | 'identity_cohort_firewall' | 'unsupported';
  resultCount: number; sourceContract: string[]; parserLatencyMs: number;
  routingLatencyMs: number; resolverLatencyMs: number; overallLatencyMs: number;
};
