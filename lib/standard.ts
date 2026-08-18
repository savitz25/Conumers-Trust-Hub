/**
 * The Ask Trust Hub Standard — network methodology framework.
 * Vertical hubs inherit this Standard and document industry-specific checks.
 */

export type StandardPipelineStep = {
  id: string;
  step: string;
  verb: string;
  title: string;
  /** Plain-language summary */
  body: string;
  means: string;
  includes: string[];
  notClaimed: string[];
};

export const STANDARD_PIPELINE: StandardPipelineStep[] = [
  {
    id: 'source',
    step: '01',
    verb: 'SOURCE',
    title: 'Prefer authoritative public sources',
    body: 'Each hub starts with attributable primary sources for its market — regulators, licenses, complaint systems, and other public records — not pay-to-rank feeds.',
    means:
      'We prioritize official registries and public records that a careful consumer could re-check, over marketing claims or brokered “top lists.”',
    includes: [
      'Federal and state regulatory databases where applicable (FMCSA/SAFER, NMLS Consumer Access, state DOI / NAIC pathways)',
      'Public complaint or enforcement datasets when used as pattern signals',
      'Clear naming of source classes on hub methodology pages',
    ],
    notClaimed: [
      'That every public dataset is complete or real-time',
      'That secondary review platforms replace licensing registries',
      'That we have private regulator access beyond published public records',
    ],
  },
  {
    id: 'verify',
    step: '02',
    verb: 'VERIFY',
    title: 'Match identity carefully; admit what we cannot prove',
    body: '“Verified” means we attempted to match legal identity, license or authority identifiers, and jurisdiction against primary public records when available.',
    means:
      'Verification is an attempt to ground claims in public identity and authority fields — not a guarantee of future performance or a seal of endorsement.',
    includes: [
      'Matching legal names, license numbers, and jurisdictions when records allow',
      'Disclosing when matching fails (rebrands, lagging registries, incomplete fields)',
      'Refusing to dress unverifiable claims as confirmed fact',
    ],
    notClaimed: [
      'That a listing is “guaranteed licensed forever”',
      'That we inspected every vehicle, branch, or employee in person',
      'That verification equals a recommendation to hire or apply',
    ],
  },
  {
    id: 'disclose',
    step: '03',
    verb: 'DISCLOSE',
    title: 'Show limits, independence, and funding honesty',
    body: 'Research tools without limitations language train false confidence. Disclosure is part of the product, not a footer afterthought.',
    means:
      'We publish independence rules, revenue honesty, data lag expectations, and what scores or badges do not mean.',
    includes: [
      'Independence policy (no paid ranking placements)',
      'How we make money (and what we will never sell)',
      'Known data limitations and re-verify guidance',
    ],
    notClaimed: [
      'That disclosure alone makes a decision “safe”',
      'That every edge case is listed on every page',
      'That commercial tools never exist — only that they cannot buy organic order',
    ],
  },
  {
    id: 'score',
    step: '04',
    verb: 'SCORE',
    title: 'Optional comparison aids — never for sale',
    body: 'Where a hub shows a composite score, it is a research aid for scanning public signals — not a guarantee, credit decision, or regulatory seal.',
    means:
      'Scoring is vertical-specific. There is no single universal numeric formula forced across moving, lending, and insurance. Industries differ; factors differ.',
    includes: [
      'Hub-specific factors published on that hub’s methodology (when scoring is used)',
      'Explainable ingredients over opaque ranking theater',
      'Hard rule: ranking position and scores are not sold',
    ],
    notClaimed: [
      'A network-wide “Trust Score” that means the same thing in every industry',
      'Creditworthiness, insurability, or regulatory approval',
      'That identical high scores across a market are a feature (they are a bug)',
    ],
  },
  {
    id: 'update',
    step: '05',
    verb: 'UPDATE',
    title: 'Freshness matters; records change',
    body: 'Licenses lapse, authorities change, complaints accumulate, and companies rebrand. Hubs refresh data through automated and/or periodic processes where built.',
    means:
      'We treat public records as living systems. Consumers should re-check primary sources before committing money or signature.',
    includes: [
      'Periodic refresh practices documented per hub where implemented',
      'Guidance to re-verify on FMCSA, NMLS, DOI/NAIC, and the company itself',
      'Corrections process for material factual errors',
    ],
    notClaimed: [
      'Instant synchronization with every regulator system',
      'That our copy always reflects a change the hour it happens',
      'That consumers can skip primary-source checks because we “already verified”',
    ],
  },
  {
    id: 'you-decide',
    step: '06',
    verb: 'YOU DECIDE',
    title: 'Directories support research; you confirm and choose',
    body: 'Ask Trust Hub and the specialist hubs do not book moves, originate loans, or sell insurance. You confirm licenses and terms with primary regulators and the company itself before you commit.',
    means:
      'We cite. You decide. Research infrastructure is not a marketplace transaction and not a fiduciary relationship.',
    includes: [
      'Clear separation of research tools from any commercial product',
      'Reminders to confirm written offers, policies, and licenses yourself',
      'No obligation to use a specialist hub directory to finish a decision',
    ],
    notClaimed: [
      'Legal, tax, medical, or investment advice',
      'That using the network replaces professional counsel when needed',
      'That we negotiate or guarantee outcomes with providers',
    ],
  },
];

export const STANDARD_NEVER = [
  'Sell ranking position, featured placement, or preferred display for money',
  'Originate loans, sell insurance policies, or book household moves',
  'Treat paid advertising as verification',
  'Present modeled or estimated figures as regulatory fact without labeling',
  'Force one universal numeric formula across unrelated industries',
  'Claim we verified a field when the primary record was missing or unmatched',
] as const;

export const STANDARD_INHERITANCE = [
  {
    hub: 'Move Trust Hub',
    domain: 'movetrusthub.com',
    url: 'https://www.movetrusthub.com/about/how-we-score-movers',
    focus:
      'FMCSA / SAFER authority, interstate mover identity, complaint and safety context, reputation composites, and review attribution rules for the moving industry.',
  },
  {
    hub: 'Insurance Trust Hub',
    domain: 'insurancetrusthub.com',
    url: 'https://www.insurancetrusthub.com/methodology',
    focus:
      'State DOI / NAIC producer pathways, agency identity, educational tools, and disclosed limits for insurance research — not policy sales.',
  },
  {
    hub: 'Lender Trust Hub',
    domain: 'lendertrusthub.com',
    url: 'https://www.lendertrusthub.com/methodology',
    focus:
      'NMLS Consumer Access context, mortgage research signals, complaint transparency, and Trust Score philosophy for financing research — not loan origination.',
  },
  {
    hub: 'Contractor Trust Hub',
    domain: 'contractortrusthub.com',
    url: 'https://www.contractortrusthub.com',
    focus:
      'State licensing-board and registration evidence with state-specific depth — not identical coverage in every state, and not a marketplace.',
  },
  {
    hub: 'SeniorTrustHub',
    domain: 'seniortrusthub.com',
    url: 'https://www.seniortrusthub.com',
    focus:
      'CMS and supported state regulatory evidence for senior care research — not placement, referrals, or paid rankings.',
  },
  {
    hub: 'InvestorTrustHub',
    domain: 'investortrusthub.com',
    url: 'https://www.investortrusthub.com',
    focus:
      'SEC / IARD investment-firm research. Not FINRA people coverage, stock recommendations, or portfolio advice.',
  },
] as const;

export const STANDARD_VOCABULARY = [
  {
    term: 'Verified',
    meaning:
      'We matched key identity or authority fields to an attributable public source for that vertical — subject to data lag and matching limits. Not a promise of future performance.',
  },
  {
    term: 'Trust Score / Reputation Score',
    meaning:
      'An optional composite research signal using vertical-specific public factors. Not a credit score, endorsement, or product you can buy. Not a single network-wide formula.',
  },
  {
    term: 'Primary source',
    meaning:
      'The regulator or official public registry that owns the authoritative record (e.g. FMCSA, state DOI, NMLS Consumer Access).',
  },
  {
    term: 'Attributed review',
    meaning:
      'A review signal shown with its source platform. We do not invent testimonials or sell review placement.',
  },
  {
    term: 'Independent (research ordering)',
    meaning:
      'No paid placements in ranking order. Common ownership across hubs; research and listing order are not for sale.',
  },
] as const;
