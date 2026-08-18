/**
 * Structured primary-source library for Ask Trust Hub /data-sources.
 * Prefer regulatory/government sources over secondary summaries.
 */

export type DataSourceEntry = {
  id: string;
  name: string;
  whatItIs: string;
  provides: string;
  howWeUse: string;
  cannotProve: string;
  url: string;
  lastReviewed: string;
};

export type DataSourceVertical = {
  id: 'moving' | 'lending' | 'insurance' | 'contractor' | 'senior' | 'investor' | 'network';
  title: string;
  hubLabel: string;
  hubUrl?: string;
  intro: string;
  sources: DataSourceEntry[];
};

export const DATA_SOURCE_VERTICALS: DataSourceVertical[] = [
  {
    id: 'moving',
    title: 'Moving',
    hubLabel: 'Move Trust Hub',
    hubUrl: 'https://www.movetrusthub.com',
    intro:
      'Interstate household-goods movers are primarily regulated at the federal level for interstate authority, with state rules for local moves. Start with FMCSA public systems.',
    sources: [
      {
        id: 'fmcsa',
        name: 'FMCSA (Federal Motor Carrier Safety Administration)',
        whatItIs:
          'U.S. DOT agency that oversees commercial motor carriers, including interstate household goods movers.',
        provides:
          'Operating authority context, company identity fields, and safety-related public information for interstate carriers.',
        howWeUse:
          'Move Trust Hub uses FMCSA-oriented public records as the backbone for mover research and Verify DOT style workflows — not as a paid ranking feed.',
        cannotProve:
          'That a move will go well, that a carrier’s local operations match every listing claim, or that records are updated the minute a status changes.',
        url: 'https://www.fmcsa.dot.gov/',
        lastReviewed: '2026-08-07',
      },
      {
        id: 'safer',
        name: 'SAFER (Safety and Fitness Electronic Records)',
        whatItIs:
          'FMCSA public system commonly used to look up carrier snapshots and related public company data.',
        provides:
          'Public company/carrier snapshots used for identity and fitness-related research context.',
        howWeUse:
          'Supporting lookup path for interstate mover identity and public safety context on Move Trust Hub research tools.',
        cannotProve:
          'Real-time status of every truck, driver, or complaint; SAFER is a research aid, not a live dispatch system.',
        url: 'https://safer.fmcsa.dot.gov/',
        lastReviewed: '2026-08-07',
      },
      {
        id: 'state-moving',
        name: 'State mover licensing (where applicable)',
        whatItIs:
          'Some states regulate intrastate movers separately from FMCSA interstate authority.',
        provides:
          'State-level licensing or registration context for local moves, varying by jurisdiction.',
        howWeUse:
          'Referenced when Move Trust Hub research notes state-level requirements; always re-check the state’s official site for the address you care about.',
        cannotProve:
          'A single national “local mover license” database — state systems differ and coverage is incomplete.',
        url: 'https://www.movetrusthub.com/about/how-we-score-movers',
        lastReviewed: '2026-08-07',
      },
    ],
  },
  {
    id: 'lending',
    title: 'Lending / home financing',
    hubLabel: 'Lender Trust Hub',
    hubUrl: 'https://www.lendertrusthub.com',
    intro:
      'Mortgage and consumer lending research should start with public licensing and complaint systems — not broker “preferred lender” marketing.',
    sources: [
      {
        id: 'nmls',
        name: 'NMLS Consumer Access',
        whatItIs:
          'Public consumer access to the Nationwide Multistate Licensing System for many mortgage-related licenses.',
        provides:
          'Company and individual license identifiers, status context, and jurisdiction information where published.',
        howWeUse:
          'Lender Trust Hub surfaces NMLS-oriented identifiers and research aids so you can re-check records yourself on Consumer Access.',
        cannotProve:
          'Loan approval, best rate, or that a license status will remain unchanged after you apply.',
        url: 'https://www.nmlsconsumeraccess.org/',
        lastReviewed: '2026-08-07',
      },
      {
        id: 'cfpb',
        name: 'CFPB consumer complaint data',
        whatItIs:
          'Consumer Financial Protection Bureau public complaint datasets and tools.',
        provides:
          'Complaint patterns by company/product as a risk and research signal — not a court verdict.',
        howWeUse:
          'Where used, as an attributed pattern signal in financing research — never as a paid ranking input.',
        cannotProve:
          'That complaint volume alone proves wrongdoing, or that absence of complaints means excellence.',
        url: 'https://www.consumerfinance.gov/data-research/consumer-complaints/',
        lastReviewed: '2026-08-07',
      },
      {
        id: 'fdic',
        name: 'FDIC and related banking public records',
        whatItIs:
          'Federal Deposit Insurance Corporation and related federal banking public information systems.',
        provides:
          'Identity and public status context for insured depository institutions where relevant to research.',
        howWeUse:
          'Supporting identity context on Lender Trust Hub when bank vs non-bank distinctions matter for research tools.',
        cannotProve:
          'Credit decisions, product suitability, or that FDIC insurance applies to every product a company markets.',
        url: 'https://www.fdic.gov/',
        lastReviewed: '2026-08-07',
      },
    ],
  },
  {
    id: 'insurance',
    title: 'Insurance',
    hubLabel: 'Insurance Trust Hub',
    hubUrl: 'https://www.insurancetrusthub.com',
    intro:
      'Insurance producer and agency licensing is primarily state-based. NAIC helps coordinate multi-state reference points; the state DOI is usually the authority of record.',
    sources: [
      {
        id: 'doi',
        name: 'State Departments of Insurance (DOI)',
        whatItIs:
          'State regulators that license insurance producers and agencies and publish consumer tools that vary by state.',
        provides:
          'License status, lines of authority context, and consumer complaint or enforcement information depending on the state.',
        howWeUse:
          'Insurance Trust Hub orients research around DOI / public license context and educational tools — not policy sales.',
        cannotProve:
          'That a license guarantees claim service quality, or that every state publishes equally complete open data.',
        url: 'https://content.naic.org/state-insurance-departments',
        lastReviewed: '2026-08-07',
      },
      {
        id: 'naic',
        name: 'NAIC (National Association of Insurance Commissioners)',
        whatItIs:
          'Association of state insurance regulators providing multi-state coordination and consumer-facing resources.',
        provides:
          'Reference pathways, consumer education, and links into state systems — not a single national producer license.',
        howWeUse:
          'As a coordinating reference for multi-state insurance research context on Insurance Trust Hub.',
        cannotProve:
          'A substitute for checking the specific state’s DOI for the producer or agency you are considering.',
        url: 'https://content.naic.org/',
        lastReviewed: '2026-08-07',
      },
      {
        id: 'medicare-edu',
        name: 'Medicare.gov and CMS educational resources',
        whatItIs:
          'Federal educational and plan-finding resources for Medicare beneficiaries.',
        provides:
          'Official educational context for Medicare research (plans, rights, and government tools).',
        howWeUse:
          'Educational routing and research support on Insurance Trust Hub tools — not as a sales channel.',
        cannotProve:
          'That a private agent recommendation is endorsed by CMS, or that plan details never change.',
        url: 'https://www.medicare.gov/',
        lastReviewed: '2026-08-07',
      },
    ],
  },
  {
    id: 'contractor',
    title: 'Contractors',
    hubLabel: 'Contractor Trust Hub',
    hubUrl: 'https://www.contractortrusthub.com',
    intro:
      'Contractor licensing is state-based. Official board evidence depth varies by jurisdiction. Missing records do not mean a clean history.',
    sources: [
      {
        id: 'state-boards',
        name: 'State contractor licensing boards',
        whatItIs:
          'State agencies and professional boards that license or register contractors and related trades.',
        provides:
          'License or registration status, board identity, and — where published — discipline or enforcement extracts.',
        howWeUse:
          'Contractor Trust Hub organizes official-board evidence with state-specific depth. It is not a marketplace.',
        cannotProve:
          'Identical coverage in every state, workmanship quality, or that an absent record means no history exists.',
        url: 'https://www.contractortrusthub.com',
        lastReviewed: '2026-08-18',
      },
    ],
  },
  {
    id: 'senior',
    title: 'Senior care',
    hubLabel: 'SeniorTrustHub',
    hubUrl: 'https://www.seniortrusthub.com',
    intro:
      'Senior care research starts with government sources. SeniorTrustHub is research infrastructure — not a placement agency or referral marketplace.',
    sources: [
      {
        id: 'cms',
        name: 'CMS (Centers for Medicare & Medicaid Services)',
        whatItIs:
          'Federal agency that publishes nursing-home and related provider quality and certification data.',
        provides:
          'Public facility identity and quality-measure context where CMS publishes it.',
        howWeUse:
          'SeniorTrustHub uses CMS and supported state regulators as research evidence. It does not place residents or sell referrals.',
        cannotProve:
          'That a facility is the right choice, or that unpublished state actions do not exist.',
        url: 'https://www.medicare.gov/care-compare/',
        lastReviewed: '2026-08-18',
      },
    ],
  },
  {
    id: 'investor',
    title: 'Investment firms',
    hubLabel: 'InvestorTrustHub',
    hubUrl: 'https://www.investortrusthub.com',
    intro:
      'Current InvestorTrustHub research is SEC/IARD firm evidence. It is not a broker directory, FINRA people product, or advice engine.',
    sources: [
      {
        id: 'sec-iard',
        name: 'SEC / IARD',
        whatItIs:
          'U.S. Securities and Exchange Commission investment adviser registration data via IARD / Form ADV.',
        provides:
          'Firm identity, registration classification, and filer-supplied Form ADV fields used for research.',
        howWeUse:
          'InvestorTrustHub organizes official firm filings so you can research before you invest. Source “Approved” is not SEC endorsement.',
        cannotProve:
          'That a firm is suitable, that people/broker records are included, or that missing disclosures mean a clean history.',
        url: 'https://adviserinfo.sec.gov/',
        lastReviewed: '2026-08-18',
      },
    ],
  },
  {
    id: 'network',
    title: 'Network-wide secondary signals',
    hubLabel: 'All hubs (secondary)',
    intro:
      'These sources may appear as attributed supplements. They never replace licensing registries.',
    sources: [
      {
        id: 'reviews',
        name: 'Attributed third-party reviews',
        whatItIs:
          'Public review platforms and aggregates when a hub chooses to show reputation context.',
        provides:
          'Consumer-reported experience signals that must be attributed to a source platform.',
        howWeUse:
          'Optional, attributed reputation context. We do not invent testimonials or sell review placement.',
        cannotProve:
          'Licensing status, or that reviews are free of bias, fraud, or selection effects.',
        url: 'https://www.asktrusthub.com/editorial-standards',
        lastReviewed: '2026-08-07',
      },
      {
        id: 'bbb',
        name: 'BBB and similar public consumer records',
        whatItIs:
          'Supplementary public reputation and complaint context from non-governmental organizations.',
        provides:
          'Additional reputation context that must be clearly secondary to regulatory sources.',
        howWeUse:
          'Only as supplementary context when disclosed; never as proof of licensing.',
        cannotProve:
          'Government authority, licensing, or that accreditation equals independent verification of every claim.',
        url: 'https://www.bbb.org/',
        lastReviewed: '2026-08-07',
      },
    ],
  },
];
