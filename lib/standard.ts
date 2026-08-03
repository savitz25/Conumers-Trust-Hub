/**
 * The Ask Trust Hub Standard — network methodology framework.
 * Vertical hubs inherit this Standard and document industry-specific checks.
 */

export const STANDARD_PIPELINE = [
  {
    id: 'source',
    step: '01',
    verb: 'SOURCE',
    title: 'Prefer authoritative public sources',
    body: 'Each hub starts with attributable primary sources for its market — regulators, licenses, complaint systems, and other public records — not pay-to-rank feeds. Categories matter more than marketing claims. We name source classes openly on this page and in vertical methodology.',
  },
  {
    id: 'verify',
    step: '02',
    verb: 'VERIFY',
    title: 'Match identity carefully; admit what we cannot prove',
    body: '“Verified” at network level means we attempted to match legal identity, license or authority identifiers, and jurisdiction against primary public records when available. Matching can fail: rebrands, lagging registries, incomplete fields. Unverifiable claims are not dressed up as confirmed fact.',
  },
  {
    id: 'disclose',
    step: '03',
    verb: 'DISCLOSE',
    title: 'Show limits, independence, and funding honesty',
    body: 'Research tools without limitations language train false confidence. We publish independence policy, revenue honesty, data lag expectations, and what a score or badge does not mean. Disclosure is part of the product, not a footer afterthought.',
  },
  {
    id: 'score',
    step: '04',
    verb: 'SCORE',
    title: 'Optional comparison aids — never for sale',
    body: 'Where a hub shows a composite score, it is a research aid for scanning public signals — not a guarantee, credit decision, or regulatory seal. Verticals may use different factors because industries differ. Ranking position is not sold. A market full of identical high scores is a product bug, not a feature.',
  },
  {
    id: 'update',
    step: '05',
    verb: 'UPDATE',
    title: 'Freshness matters; records change',
    body: 'Licenses lapse, authorities change, complaints accumulate, and companies rebrand. Hubs refresh data through automated and/or periodic processes where built. Consumers should re-check primary sources before hiring a mover, choosing a lender, or buying coverage.',
  },
  {
    id: 'you-decide',
    step: '06',
    verb: 'YOU DECIDE',
    title: 'Directories support research; you confirm and choose',
    body: 'Ask Trust Hub and the specialist hubs do not book moves, originate loans, or sell insurance. You confirm licenses and terms with primary regulators and the company itself before you commit money or signature.',
  },
] as const;

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
      'An optional composite research signal using vertical-specific public factors. Not a credit score, endorsement, or product you can buy.',
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
    term: 'Independent',
    meaning:
      'No paid placements in ranking order. Commercial options, if any, stay structurally separated from editorial research ordering.',
  },
] as const;
