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
    examples: ['USDOT 3244649', 'Find USDOT 3244649'],
    pattern: /^(?:dot|usdot)?\s*\d{5,8}$/i,
    live: true,
    destinationHint: 'https://www.movetrusthub.com/ask',
    note: 'Labeled USDOT executes on MoveTrustHub Ask (move-ask-v1). USDOT is a federal identity, not an endorsement. Bare digits fail closed.',
  },
  {
    id: 'mc',
    hubId: 'move',
    label: 'MC number',
    examples: ['MC 1019808', 'Find MC 1019808'],
    pattern: /^(?:mc)?\s*\d{4,8}$/i,
    live: true,
    destinationHint: 'https://www.movetrusthub.com/ask',
    note: 'Labeled MC executes on MoveTrustHub Ask (move-ask-v1). An MC docket is not a quality ranking. Bare digits fail closed.',
  },
  {
    id: 'nmls',
    hubId: 'lender',
    label: 'NMLS',
    examples: ['NMLS 123456'],
    pattern: /^(?:nmls)\s*\d{4,12}$/i,
    live: true,
    destinationHint: 'https://www.lendertrusthub.com/ask',
    note: 'Labeled NMLS executes on LenderTrustHub Ask (lender-ask-v1), which resolves a labeled institution NMLS to its exact reporting identity (TH-SEARCH-R1-016; previously handoff-only, pre-dating lender-ask-v1’s identifier mode added in TH-SEARCH-R1-002). NMLS institution, branch, and person/MLO IDs are separate identity grains. Bare digits fail closed.',
  },
  {
    id: 'lei',
    hubId: 'lender',
    label: 'Legal Entity Identifier (LEI)',
    examples: ['LEI 5493001KJTIIGC8Y1R12'],
    pattern: /^(?:lei)\s*#?\s*[A-Z0-9]{20}$/i,
    live: true,
    destinationHint: 'https://www.lendertrusthub.com/ask',
    note: 'Labeled LEI executes on LenderTrustHub Ask (lender-ask-v1) the same way a labeled NMLS does. An LEI identifies a legal entity; it is not a license, endorsement, or service-area claim.',
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
    id: 'pa_hic',
    hubId: 'contractor',
    label: 'Pennsylvania HICPA registration',
    examples: ['PA HIC 123456', 'HICPA 123456'],
    pattern: /^(?:pa\s+)?hic(?:pa)?\s*#?\s*\d{4,12}$/i,
    live: false,
    destinationHint: 'https://www.contractortrusthub.com/pennsylvania',
    note: 'Labeled PA HIC / HICPA is a Pennsylvania home-improvement registration identifier. It is not a general-contractor license and is not translated into a generic contractor name search. Bare digits fail closed.',
  },
  {
    id: 'nclbgc',
    hubId: 'contractor',
    label: 'NCLBGC license',
    examples: ['NCLBGC 12345'],
    pattern: /^(?:nclbgc)\s*#?\s*\d{3,12}$/i,
    live: false,
    destinationHint: 'https://www.contractortrusthub.com/north-carolina',
    note: 'Labeled NCLBGC is a North Carolina general-contractor license identifier. Current statewide roster remains search-only. Bare digits fail closed.',
  },
  {
    id: 'ncuc_c',
    hubId: 'move',
    label: 'NCUC C-number',
    examples: ['C-1234', 'NCUC C-1234'],
    pattern: /^(?:ncuc\s+)?c-\d{2,6}$/i,
    live: false,
    destinationHint: 'https://www.movetrusthub.com/north-carolina',
    note: 'Labeled NCUC C-number is a North Carolina Certificate of Exemption. It is not a T-number, USDOT, or MC. Bare digits fail closed.',
  },
  {
    id: 'ncuc_t',
    hubId: 'move',
    label: 'NCUC T-number',
    examples: ['T-1234', 'NCUC T-1234'],
    pattern: /^(?:ncuc\s+)?t-\d{2,6}$/i,
    live: false,
    destinationHint: 'https://www.movetrusthub.com/north-carolina',
    note: 'Labeled NCUC T-number is a North Carolina company/docket identity. It is not a C-number, USDOT, or MC. Bare digits fail closed.',
  },
  {
    id: 'nccob_license',
    hubId: 'lender',
    label: 'NCCOB license',
    examples: ['NCCOB license L-123456'],
    pattern: /^(?:nccob\s+license)\s*[lbr]-?\d{4,8}$/i,
    live: false,
    destinationHint: 'https://www.lendertrusthub.com/north-carolina',
    note: 'Labeled NCCOB license is distinct from an NMLS Unique ID. Ask does not mint profiles from the Show All roster. Bare digits fail closed.',
  },
  {
    id: 'ocilb_trade',
    hubId: 'contractor',
    label: 'OCILB trade credential',
    examples: ['EL.12345', 'OCILB PL.12345'],
    pattern: /^(?:ocilb\s+)?(?:el|hv|hy|pl|re)\.\d{3,8}$/i,
    live: false,
    destinationHint: 'https://www.contractortrusthub.com/ohio',
    note: 'Labeled OCILB EL/HV/HY/PL/RE is an Ohio specialty-trade credential. It is not a company license and not a statewide general-contractor license. Bare digits fail closed.',
  },
  {
    id: 'puco_no',
    hubId: 'move',
    label: 'PUCO household-goods certificate',
    examples: ['PUCO 113554-HG', 'PUCO No. 1288-HG'],
    pattern: /^(?:puco\s*(?:no\.?|#)?\s*)\d{3,7}(?:-hg)?$/i,
    live: false,
    destinationHint: 'https://www.movetrusthub.com/ohio',
    note: 'Labeled PUCO number is an Ohio household-goods certificate. It is not a USDOT or MC number. Bare digits fail closed.',
  },
  {
    id: 'odh_nh',
    hubId: 'senior',
    label: 'ODH Nursing Home license',
    examples: ['OH12345', 'ODH OH12345'],
    pattern: /^(?:odh\s+)?oh\d{4,6}$/i,
    live: false,
    destinationHint: 'https://www.seniortrusthub.com/ohio',
    note: 'Labeled ODH OH##### is an Ohio Nursing Home license. It is not an RCF OHL##### and not a CMS CCN. Bare digits fail closed.',
  },
  {
    id: 'odh_rcf',
    hubId: 'senior',
    label: 'ODH Residential Care Facility license',
    examples: ['OHL12345', 'ODH OHL12345'],
    pattern: /^(?:odh\s+)?ohl\d{4,6}$/i,
    live: false,
    destinationHint: 'https://www.seniortrusthub.com/ohio',
    note: 'Labeled ODH OHL##### is an Ohio Residential Care Facility license. It is not a Nursing Home OH##### and not a CMS CCN. Bare digits fail closed.',
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

/**
 * TH-ARCH-P0-001: shared filler-word source for "<label> [company] [code|number|no.] [#] <value>"
 * phrasings ("NAIC code 10064", "NPN number 20000635"). Single authority for ask-parse.ts's
 * canonical `matchIdentifier` and guided-research/session.ts's `parseLabeledIdentifier` (still
 * used there for anchored single-field follow-up input, which never re-parses a canonical plan).
 * Originated as TH-SEARCH-R1-018 BLOCKER-IDENTIFIER-FILLER-WORD-01.
 */
export const IDENTIFIER_FILLER_SOURCE = String.raw`(?:\s+company)?(?:\s+(?:code|number|no\.?))?\s*#?-?\s*`;
