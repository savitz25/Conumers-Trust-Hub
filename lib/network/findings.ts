export type NetworkFinding = {
  id: 'evidence-models' | 'identity' | 'geography';
  headline: string;
  examples: string[];
  whyItMatters: string;
  takeaway: string;
  limitation: string;
  hubs: string[];
  cta: { label: string; href: string };
};

export const NETWORK_FINDINGS: NetworkFinding[] = [
  {
    id: 'evidence-models',
    headline: 'Public records answer very different questions depending on the market.',
    examples: [
      'HMDA describes mortgage-market activity, not whether a lender is “good.”',
      'CMS publishes senior-care quality, staffing, and ownership evidence — by provider class.',
      'Contractor regulation is state-board evidence and varies by jurisdiction.',
      'Form ADV describes adviser structure and compensation, not performance.',
    ],
    whyItMatters:
      'Forcing one transparency score would hide those differences. TrustHub keeps unlike evidence models separate.',
    takeaway: 'Use the specialist hub that owns the evidence model you actually need.',
    limitation: 'This is a descriptive comparison of evidence models, not a ranking of markets or firms.',
    hubs: ['lender', 'senior', 'contractor', 'investor'],
    cta: { label: 'Explore how evidence differs', href: '/network#evidence-models' },
  },
  {
    id: 'identity',
    headline: 'The company name is not always the regulated entity.',
    examples: [
      'A mover brand may be a carrier, a broker, or both — confirm who hauls.',
      'Insurance: legal insurer, agency, and producer are different roles.',
      'Lending: the institution on paperwork may not be the servicer you call later.',
      'Senior care: the facility you visit may be owned by a different organization.',
      'Investment advisers: RIA vs ERA is a classification, not a quality grade.',
    ],
    whyItMatters:
      'Matching a display name is not the same as matching a license, USDOT, NMLS, CCN, or IARD identity.',
    takeaway: 'Compare identifiers on the estimate, contract, or filing — not the marketing name alone.',
    limitation: 'Ask does not merge similar names across hubs into one legal entity.',
    hubs: ['move', 'insurance', 'lender', 'senior', 'investor'],
    cta: { label: 'See how TrustHub resolves identity', href: '/network#identity' },
  },
  {
    id: 'geography',
    headline: 'Geography means different things in different public records.',
    examples: [
      'A contractor address county is not service territory.',
      'HMDA property county is not lender headquarters.',
      'An adviser principal office is not necessarily client geography.',
      'State licensing can differ from physical location.',
    ],
    whyItMatters:
      'Consumers often treat an address as “where they work.” Public records often mean something else.',
    takeaway: 'Read the grain: headquarters, property location, principal office, and license state are not interchangeable.',
    limitation: 'Prompt 1 does not publish a 50-state coverage atlas; this finding is the consumer lesson.',
    hubs: ['contractor', 'lender', 'investor', 'move'],
    cta: { label: 'Explore geography and coverage', href: '/network#geography' },
  },
];
