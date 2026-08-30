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
    note: 'NMLS is a labeled handoff to NMLS Consumer Access and LenderTrustHub search. Not a live federated graph query.',
  },
  {
    id: 'npn',
    hubId: 'insurance',
    label: 'NPN',
    examples: ['NPN 10391484', 'Find NPN 10391484'],
    pattern: /^(?:npn)\s*#?\s*\d{4,12}$/i,
    live: true,
    destinationHint: 'https://www.insurancetrusthub.com/ask',
    note: 'Labeled NPN executes on InsuranceTrustHub Ask (insurance-ask-v1). NPN may be an organization or a person; class is not assumed from the digits. Public people pages remain unpublished. Bare digits fail closed.',
  },
  {
    id: 'naic_company_code',
    hubId: 'insurance',
    label: 'NAIC company code',
    examples: ['NAIC 10064', 'Find insurer NAIC code 10064'],
    pattern: /^(?:naic(?:\s+company)?(?:\s+code)?)\s*#?\s*\d{3,6}$/i,
    live: true,
    destinationHint: 'https://www.insurancetrusthub.com/ask',
    note: 'Labeled NAIC company code executes on InsuranceTrustHub Ask as a legal insurer identity. A consumer brand is not assumed.',
  },
  {
    id: 'state_contractor_license',
    hubId: 'contractor',
    label: 'State contractor credential',
    examples: ['Florida CBC license'],
    pattern: /^(?:cbc|cgc|ccc)\s*[-#]?\s*\d+/i,
    live: true,
    destinationHint: 'https://www.contractortrusthub.com/verify',
    note: 'Florida CILB prefixes (CBC/CGC/CCC/…) route to ContractorTrustHub Verify. Other states need an explicit state. Pattern match is not a national license.',
  },
  {
    id: 'cms_ccn',
    hubId: 'senior',
    label: 'CMS CCN',
    examples: ['CCN 105502', 'Find CMS CCN 105502'],
    pattern: /^(?:cms\s+)?ccn\s*#?\s*\d{6}$/i,
    live: true,
    destinationHint: 'https://www.seniortrusthub.com/ask',
    note: 'Labeled CMS CCN executes on SeniorTrustHub Ask (senior-ask-v1). Ask does not query CMS. Bare 6-digit strings fail closed.',
  },
  {
    id: 'crd',
    hubId: 'investor',
    label: 'CRD / SEC firm identifier',
    examples: ['CRD 166089', 'Find CRD 166089'],
    pattern: /^(?:crd)\s*\d{4,10}$/i,
    live: true,
    destinationHint: 'https://www.investortrusthub.com/ask',
    note: 'Labeled CRD executes on InvestorTrustHub Ask (investor-ask-v1). Public IAR/people lookup is not published. Bare digits fail closed.',
  },
];

export function collidingBareDigitsNote(): string {
  return 'Bare digits can mean USDOT, NMLS, CCN, CRD, NPN, or NAIC company code. Ask must preserve ambiguity and not auto-select a hub from digits alone.';
}
