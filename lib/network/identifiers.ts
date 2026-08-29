import type { SpecialistHubId } from './registry.ts';

export type IdentifierFamily = {
  id: string;
  hubId: SpecialistHubId;
  label: string;
  examples: string[];
  pattern: RegExp;
  live: boolean;
  destinationHint: string;
  note: string;
};

/**
 * Identifier routing vocabulary. Prompt 1 documents and maps; it does not
 * invent live lookup for unsupported identifiers.
 */
export const IDENTIFIER_FAMILIES: IdentifierFamily[] = [
  {
    id: 'usdot',
    hubId: 'move',
    label: 'USDOT',
    examples: ['DOT 3244649', '3244649'],
    pattern: /^(?:dot|usdot)?\s*\d{5,8}$/i,
    live: true,
    destinationHint: 'https://www.movetrusthub.com/verify-dot',
    note: 'MoveTrustHub Search V1 treats explicit DOT / USDOT as a regulatory identifier.',
  },
  {
    id: 'mc',
    hubId: 'move',
    label: 'MC number',
    examples: ['MC 1019808'],
    pattern: /^(?:mc)?\s*\d{4,8}$/i,
    live: true,
    destinationHint: 'https://www.movetrusthub.com/verify-dot',
    note: 'Ambiguous bare digits are not auto-promoted to MC.',
  },
  {
    id: 'nmls',
    hubId: 'lender',
    label: 'NMLS',
    examples: ['NMLS 123456'],
    pattern: /^(?:nmls)\s*\d{4,12}$/i,
    live: false,
    destinationHint: 'https://www.nmlsconsumeraccess.org/',
    note: 'Ask routes to LenderTrustHub / NMLS Consumer Access. Do not present as a live Ask graph query.',
  },
  {
    id: 'npn',
    hubId: 'insurance',
    label: 'NPN / producer license',
    examples: ['NPN 1234567'],
    pattern: /^(?:npn)\s*\d{5,12}$/i,
    live: false,
    destinationHint: 'https://www.insurancetrusthub.com',
    note: 'Insurance producer identifiers are state/NAIC oriented. Not a live federated lookup in Prompt 1.',
  },
  {
    id: 'state_contractor_license',
    hubId: 'contractor',
    label: 'State contractor credential',
    examples: ['Florida CBC license'],
    pattern: /^(?:cbc|cgc|ccc)\s*[-#]?\s*\d+/i,
    live: false,
    destinationHint: 'https://www.contractortrusthub.com',
    note: 'Credential formats collide across states. Do not treat a pattern match as a live lookup.',
  },
  {
    id: 'cms_ccn',
    hubId: 'senior',
    label: 'CMS CCN',
    examples: ['CCN 105502'],
    pattern: /^(?:ccn)?\s*\d{6}$/i,
    live: false,
    destinationHint: 'https://www.seniortrusthub.com',
    note: 'Documented for future Ask. Prompt 1 routes/explains rather than querying CMS.',
  },
  {
    id: 'crd',
    hubId: 'investor',
    label: 'CRD / SEC firm identifier',
    examples: ['CRD 123456'],
    pattern: /^(?:crd)\s*\d{4,10}$/i,
    live: false,
    destinationHint: 'https://www.investortrusthub.com',
    note: 'InvestorTrustHub is firm/IARD research. CRD people lookup is not claimed live.',
  },
];

export function collidingBareDigitsNote(): string {
  return 'Bare digits can mean USDOT, NMLS, CCN, or CRD. Ask must preserve ambiguity and not auto-select a hub from digits alone.';
}
