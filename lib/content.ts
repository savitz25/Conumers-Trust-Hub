/** Shared editorial content for the thin parent site */

export const INDEPENDENCE_PLEDGES = [
  {
    title: 'Zero paid placements',
    body: 'No company may purchase ranking, featured position, or preferred display on any Trust Hub. Listings and scores follow published methodology and verification data.',
  },
  {
    title: 'No transactional role',
    body: 'The network is not a mover, lender, broker, or insurance agency. It does not originate loans, sell policies, or book moves. Its function is independent research infrastructure.',
  },
  {
    title: 'Transparent methodology',
    body: 'Verification process, data sources, and known limitations are published. Primary sources remain available for independent re-checking.',
  },
  {
    title: 'Corrections policy',
    body: 'Material errors are corrected. Incomplete data is disclosed. Accuracy is treated as an operational requirement, not a marketing claim.',
  },
] as const;

export const VERIFICATION_STEPS = [
  {
    step: '01',
    title: 'Identify regulated primary sources',
    body: 'Each hub starts with the authoritative public registry for that market—FMCSA for movers, state DOI/NAIC pathways for insurance, NMLS Consumer Access for lenders.',
  },
  {
    step: '02',
    title: 'Confirm active licensing & identity',
    body: 'We match legal names, license numbers, operating authorities, and jurisdiction where available. Unverifiable entities do not earn trusted display.',
  },
  {
    step: '03',
    title: 'Layer public risk signals',
    body: 'Where available we incorporate complaint density, disciplinary flags, years in operation, and other public risk indicators—never as a black-box score without explanation.',
  },
  {
    step: '04',
    title: 'Attribute third-party reputation carefully',
    body: 'Review signals are attributed and contextualized. We do not invent testimonials, inflate ratings, or let paid campaigns rewrite trust.',
  },
  {
    step: '05',
    title: 'Disclose limits and require re-verification',
    body: 'Public records can lag. Trust Hubs disclose data limitations and instruct consumers to confirm licenses and contractual terms with regulators and providers before committing.',
  },
] as const;

export const TRUST_SCORE_PHILOSOPHY = [
  {
    title: 'Composite, not a star average',
    body: 'Trust Scores (where used) combine licensing standing, public risk signals, operational history, and attributed reputation. A high score is a research signal—not a guarantee of future performance.',
  },
  {
    title: 'Explainable factors',
    body: 'We avoid opaque ranking theater. Consumers should understand the main ingredients of a score and where judgment enters editorial curation.',
  },
  {
    title: 'Not for sale',
    body: 'No fee improves a Trust Score. No package buys a badge. Score methodology is network policy, not a commercial product feature for providers.',
  },
] as const;

export const DATA_SOURCES = [
  {
    name: 'FMCSA / SAFER',
    hubs: ['MoveTrustHub'],
    description:
      'U.S. Department of Transportation Federal Motor Carrier Safety Administration licensing, operating authority, and safety-related public records for interstate movers.',
  },
  {
    name: 'State Departments of Insurance (DOI) & NAIC pathways',
    hubs: ['InsuranceTrustHub'],
    description:
      'State-level producer and agency licensing records, with NAIC as a coordinating reference for multi-state insurance markets.',
  },
  {
    name: 'NMLS Consumer Access',
    hubs: ['LenderTrustHub'],
    description:
      'Nationwide Multistate Licensing System public consumer access for mortgage loan originators and related license types.',
  },
  {
    name: 'CFPB complaint data',
    hubs: ['LenderTrustHub', 'Network'],
    description:
      'Consumer Financial Protection Bureau public complaint datasets as a risk and pattern signal—not a verdict on any single company.',
  },
  {
    name: 'FDIC and other public financial records',
    hubs: ['LenderTrustHub'],
    description:
      'Where relevant, insured depository institution identity and public status from federal banking regulators.',
  },
  {
    name: 'Attributed third-party reviews',
    hubs: ['All hubs'],
    description:
      'Review aggregates and excerpts are attributed to source platforms where used. We do not fabricate reviews or sell review placement.',
  },
  {
    name: 'BBB and other public consumer records',
    hubs: ['Network'],
    description:
      'Supplementary public reputation and complaint context, always secondary to licensing registries and clearly disclosed when used.',
  },
] as const;

export const EDITORIAL_STANDARDS = {
  quality: [
    'Prioritize primary regulatory sources over marketing claims.',
    'Separate facts, scores, and opinion. Label editorial judgment clearly.',
    'Do not publish thin location spam or automated doorway pages on the parent site.',
    'Specialist hubs own depth; the parent owns network standards and discovery.',
    'Write for a careful consumer making a high-stakes decision—not for clickbait.',
  ],
  corrections: [
    'Report factual errors via hello@consumerstrusthub.com with the URL, the claimed error, and a source for the correction.',
    'Material factual corrections are reviewed promptly and applied network-wide when relevant.',
    'We note significant corrections on affected pages when the change could have influenced a decision.',
    'Disputes from providers are considered against public records—not against sponsorship willingness.',
  ],
  aiUse: [
    'We may use AI tools to draft, summarize, organize research, or assist engineering—never as an unsupervised source of licensing status.',
    'License numbers, authority status, and legal identity claims must be grounded in primary public sources or human verification.',
    'AI-generated copy is reviewed for accuracy, neutrality, and compliance with our independence policy before publication.',
    'We do not use AI to fabricate reviews, invent credentials, or simulate consumer testimonials.',
  ],
} as const;

export const REVENUE_MODEL = {
  current: [
    'The network is early-stage and founder-operated.',
    'Core research pages and directories are free for consumers.',
    'We do not currently sell paid placements, sponsored rankings, or “featured” slots that alter trust ordering.',
  ],
  intended: [
    'Optional premium tools for consumers (e.g., deeper planning utilities) that never rewrite independent rankings.',
    'Transparent B2B products that do not buy trust—such as verified profile data access, compliance dashboards, or opt-in lead products clearly labeled as commercial and separated from editorial ranking.',
    'If advertising or affiliate relationships are ever introduced, they will be labeled and structurally isolated from Trust Scores and organic research ordering.',
  ],
  never: [
    'Selling ranking position',
    'Undisclosed paid endorsements',
    'Letting providers edit Trust Scores',
    'Pretending commercial content is independent research',
  ],
} as const;

export const NAV_PRIMARY = [
  { href: '/promise', label: 'Our Promise' },
  { href: '/methodology', label: 'How We Verify' },
  { href: '/#trust-hubs', label: 'The Trust Hubs' },
  { href: '/who-we-are', label: 'Who We Are' },
] as const;

export const FOOTER_ABOUT = [
  { href: '/about', label: 'About the Network' },
  { href: '/who-we-are', label: 'Who We Are' },
  { href: '/how-we-make-money', label: 'How We Make Money' },
  { href: '/editorial-standards', label: 'Editorial Standards' },
  { href: '/data-sources', label: 'Data Sources' },
  { href: '/corrections', label: 'Corrections' },
  { href: '/contact', label: 'Contact' },
] as const;

export const FOOTER_LEGAL = [
  { href: '/promise', label: 'Independence' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
] as const;
