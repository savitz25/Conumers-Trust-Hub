import type { AcademicProjectBrief } from './types';

/**
 * Turnkey research questions for a future classroom / capstone library.
 * These are not marketing tasks and are not currently paired with released datasets.
 */
export const ACADEMIC_PROJECTS: readonly AcademicProjectBrief[] = [
  {
    id: 'enforcement-predicts-complaints',
    title: 'Can regulatory enforcement predict subsequent consumer complaints?',
    academicTrack: 'public-policy-consumer-protection',
    recommendedLevel: 'capstone',
    verticals: ['move', 'lender', 'contractor'],
    researchQuestion:
      'After a public enforcement or disciplinary event appears in a regulator’s records, do later consumer-complaint patterns change in a measurable way — and in which verticals is the relationship weakest?',
    whyItMatters:
      'Consumers and journalists often treat a single enforcement record as a lasting risk signal. Measuring lag, attenuation, and missing-data bias would test that assumption without implying TrustHub scores.',
    possibleDatasetIds: ['move-regulatory-identity', 'lender-nmls-company', 'contractor-state-license'],
    suggestedMethods: [
      'Event-study or difference-in-timing designs around public action dates',
      'Careful handling of complaint-system coverage differences across agencies',
      'Falsification checks using unrelated product categories',
    ],
    expectedDifficulty: 'advanced',
    privacyLegalConsiderations: [
      'Named-business analysis of public records still requires defamation and source-term review before publication of extracts.',
      'Do not merge consumer-level complaint text that could re-identify individuals.',
    ],
    potentialOutput: 'Working paper plus a replication notebook using a future versioned snapshot — not a TrustHub ranking product.',
    irbLikely: false,
  },
  {
    id: 'geographic-enforcement-intensity',
    title: 'Geographic variation in regulatory enforcement intensity',
    academicTrack: 'public-policy-consumer-protection',
    recommendedLevel: 'masters',
    verticals: ['contractor', 'insurance', 'senior'],
    researchQuestion:
      'How much of the observed difference in published enforcement counts across U.S. states is explained by industry size versus publication practice versus genuine enforcement intensity?',
    whyItMatters:
      'State boards and DOIs do not publish equally. Treating raw counts as “risk maps” can punish transparency rather than misconduct.',
    possibleDatasetIds: ['contractor-state-license', 'insurance-agency-identity', 'senior-cms-facility'],
    suggestedMethods: [
      'Normalize counts by licensed population or facility counts',
      'Code publication completeness as a separate variable',
      'Robustness checks excluding outlier states',
    ],
    expectedDifficulty: 'substantial',
    privacyLegalConsiderations: [
      'State-level aggregates are preferable to publishing thin-tailed named lists from incomplete boards.',
    ],
    potentialOutput: 'State-comparison memo with a documented incompleteness appendix.',
    irbLikely: false,
  },
  {
    id: 'entity-resolution-precision-recall',
    title: 'Measuring entity-resolution precision and recall across public business registries',
    academicTrack: 'data-science-ai',
    recommendedLevel: 'capstone',
    verticals: ['cross-network'],
    researchQuestion:
      'Using a future hand-reviewed TrustHub Entity Resolution Benchmark, what precision, recall, and false-positive rate would a simple name-and-place matcher achieve versus a more conservative exact-identifier matcher?',
    whyItMatters:
      'Public registries duplicate, rename, and DBA-shift. Over-merging unrelated firms is a consumer-protection failure, not a convenience.',
    possibleDatasetIds: [
      'move-regulatory-identity',
      'lender-nmls-company',
      'contractor-state-license',
      'investor-sec-iard-firm',
    ],
    suggestedMethods: [
      'Hold out labeled pairs from a versioned benchmark file (when it exists)',
      'Report precision, recall, FPR, FNR, and calibration — not a single accuracy number',
      'Error analysis by class (DBA, rename, corporate family, trap)',
    ],
    expectedDifficulty: 'advanced',
    privacyLegalConsiderations: [
      'Do not dump production matcher scores as if they were published research results.',
      'The benchmark specification exists; the labeled file does not, until a later academic release.',
    ],
    potentialOutput: 'Benchmark card and error taxonomy. No claimed TrustHub performance in Academic 001A.',
    irbLikely: false,
  },
  {
    id: 'phoenix-company-detection',
    title: 'Phoenix-company detection in public records',
    academicTrack: 'data-science-ai',
    recommendedLevel: 'capstone',
    verticals: ['move', 'contractor'],
    researchQuestion:
      'Can public regulatory records identify operators that dissolve or abandon an identity and later reappear under a new business name, address cluster, or officer set — without claiming a legal finding of fraud?',
    whyItMatters:
      'Household-goods moving and some construction markets have a documented public-interest problem of successive identities. Measurement should stay evidence-based and cautious.',
    possibleDatasetIds: ['move-regulatory-identity', 'contractor-state-license'],
    suggestedMethods: [
      'Graph features on addresses, officers, and identifier reuse where those fields are public',
      'Conservative labeling: “candidate successor,” not “proven phoenix”',
      'Human review protocol for false-positive traps',
    ],
    expectedDifficulty: 'advanced',
    privacyLegalConsiderations: [
      'High defamation and tortious-interference risk if published as accusations.',
      'Counsel review before any named-business successor claims leave a classroom.',
    ],
    potentialOutput: 'Method paper emphasizing uncertainty, with withheld names unless counsel clears a public version.',
    irbLikely: false,
  },
  {
    id: 'signal-calibration-audit',
    title: 'Calibration audit of TrustHub-derived research signals (where they exist)',
    academicTrack: 'data-science-ai',
    recommendedLevel: 'masters',
    verticals: ['cross-network'],
    researchQuestion:
      'Where a specialist hub publishes an explicit research score or composite signal, how well do those values calibrate to later independently observed outcomes — and where a hub does not publish a proprietary Trust Score, what happens if researchers invent one anyway?',
    whyItMatters:
      'Not every hub uses a proprietary Trust Score. Forcing a universal score across moving, lending, insurance, contractors, senior care, and investment firms would misstate the methodology.',
    possibleDatasetIds: ['move-regulatory-identity', 'lender-nmls-company', 'senior-cms-facility'],
    suggestedMethods: [
      'Inventory which hubs actually publish scores versus source-attributed panels',
      'Reliability diagrams only where a numeric signal exists and an outcome can be defined without circularity',
      'Document “no score” hubs as a negative result, not a missing feature',
    ],
    expectedDifficulty: 'substantial',
    privacyLegalConsiderations: [
      'Do not reverse-engineer unpublished ranking formulas for commercial reuse.',
    ],
    potentialOutput: 'Hub-by-hub methods note: scored vs unscored evidence models.',
    irbLikely: false,
  },
  {
    id: 'state-transparency-index',
    title: 'Regulatory transparency across U.S. states: licensing and disciplinary records',
    academicTrack: 'public-policy-consumer-protection',
    recommendedLevel: 'undergraduate',
    verticals: ['contractor', 'insurance'],
    researchQuestion:
      'How accessible are licensing lookups and disciplinary records for contractors and insurance producers across states — by search UX, bulk data, and historical retention?',
    whyItMatters:
      'Consumer protection depends on whether the public can actually retrieve the record, not only whether a statute exists.',
    possibleDatasetIds: ['contractor-state-license', 'insurance-agency-identity'],
    suggestedMethods: [
      'Structured coding of official sites (search, bulk, fees, CAPTCHA, history)',
      'Inter-rater reliability on accessibility codes',
      'No scraping that violates source terms; manual coding is acceptable',
    ],
    expectedDifficulty: 'moderate',
    privacyLegalConsiderations: [
      'Respect robots.txt and terms of official sites. This project can be done without bulk scraping.',
    ],
    potentialOutput: 'Open codebook and state scorecard of publication practice — not of “bad actors.”',
    irbLikely: false,
  },
  {
    id: 'missing-data-bias',
    title: 'Missing-data bias in consumer regulatory datasets',
    academicTrack: 'data-science-ai',
    recommendedLevel: 'masters',
    verticals: ['cross-network'],
    researchQuestion:
      'When a field, county, or state is systematically missing from public extracts, which research conclusions flip if missingness is treated as “clean” versus “unknown”?',
    whyItMatters:
      'TrustHub’s public stance is that missing evidence does not mean a clean record. That claim is testable.',
    possibleDatasetIds: [
      'contractor-state-license',
      'insurance-agency-identity',
      'senior-cms-facility',
      'lender-nmls-company',
    ],
    suggestedMethods: [
      'Compare complete-case analysis versus explicit missingness indicators',
      'Sensitivity analysis under MNAR assumptions',
      'Document overwrite risk as a missingness mechanism',
    ],
    expectedDifficulty: 'substantial',
    privacyLegalConsiderations: [
      'Do not impute consumer attributes. Missingness here is about public business-regulatory fields.',
    ],
    potentialOutput: 'Methods appendix suitable for later dataset dictionaries.',
    irbLikely: false,
  },
  {
    id: 'name-normalization-dba',
    title: 'Business-name normalization and DBA matching',
    academicTrack: 'data-science-ai',
    recommendedLevel: 'undergraduate',
    verticals: ['move', 'lender', 'investor'],
    researchQuestion:
      'How much of apparent “duplicate company” volume in public registries is explained by punctuation, legal-suffix, and DBA variation versus genuinely distinct entities?',
    whyItMatters:
      'Name cleaning is the cheapest matcher and the easiest way to create false merges.',
    possibleDatasetIds: ['move-regulatory-identity', 'lender-nmls-company', 'investor-sec-iard-firm'],
    suggestedMethods: [
      'Rule-based normalization versus learned similarity, evaluated on a future labeled sample',
      'Error analysis on LLC/Inc/National Association suffixes',
      'Report merge rate under each rule set',
    ],
    expectedDifficulty: 'moderate',
    privacyLegalConsiderations: [
      'Business names in public registries are not consumer PII, but still require accurate attribution.',
    ],
    potentialOutput: 'Normalization spec that a later academic snapshot can cite.',
    irbLikely: false,
  },
  {
    id: 'ownership-networks-nursing',
    title: 'Ownership networks and nursing-facility regulatory outcomes',
    academicTrack: 'public-policy-consumer-protection',
    recommendedLevel: 'capstone',
    verticals: ['senior'],
    researchQuestion:
      'Where CMS publishes ownership or chain relationships, how do inspection or enforcement patterns cluster — and what cannot be claimed because ownership files are incomplete or lagged?',
    whyItMatters:
      'Nursing-facility ownership is a live public-policy subject. Research must stay inside CMS (and supported state) evidence, not placement marketing.',
    possibleDatasetIds: ['senior-cms-facility'],
    suggestedMethods: [
      'Network descriptive statistics on published ownership edges',
      'Outcome models with clustered errors at chain level',
      'Explicit “unknown owner” category rather than dropping missingness',
    ],
    expectedDifficulty: 'advanced',
    privacyLegalConsiderations: [
      'Resident-level data is out of scope. Do not scrape consumer reviews into this project as if they were CMS.',
      'SeniorTrustHub is not a placement agency; outputs must not be packaged as a referral list.',
    ],
    potentialOutput: 'Policy brief with a limitations box on CMS lag and unpublished state actions.',
    irbLikely: false,
  },
  {
    id: 'data-freshness-information-loss',
    title: 'Measuring regulatory-data freshness and historical information loss',
    academicTrack: 'data-science-ai',
    recommendedLevel: 'independent-study',
    verticals: ['cross-network'],
    researchQuestion:
      'When public systems overwrite prior license status, how much historical information is lost between two calendar dates — and what research designs become impossible without immutable snapshots?',
    whyItMatters:
      'A historical snapshot can become more valuable with time precisely because regulators overwrite. This project motivates the versioning standard without running a production snapshot job.',
    possibleDatasetIds: [
      'lender-nmls-company',
      'move-regulatory-identity',
      'investor-sec-iard-firm',
    ],
    suggestedMethods: [
      'Compare two dated public pulls only if both were lawfully retained',
      'If only one pull exists, design a prospective protocol rather than inventing a second vintage',
      'Quantify field-level churn',
    ],
    expectedDifficulty: 'substantial',
    privacyLegalConsiderations: [
      'Do not scrape in violation of source terms to manufacture a second vintage.',
    ],
    potentialOutput: 'Protocol for longitudinal academic releases (see dataset-release standard).',
    irbLikely: false,
  },
  {
    id: 'matcher-confidence-calibration',
    title: 'Algorithmic confidence calibration for business identity matching',
    academicTrack: 'data-science-ai',
    recommendedLevel: 'masters',
    verticals: ['cross-network'],
    researchQuestion:
      'If a matcher emits a confidence score, does predicted confidence equal empirical match frequency across bins — or are high-confidence errors concentrated in DBA and successor cases?',
    whyItMatters:
      'Uncalibrated “95% match” labels are how false merges get into consumer-facing products.',
    possibleDatasetIds: ['move-regulatory-identity', 'contractor-state-license', 'lender-nmls-company'],
    suggestedMethods: [
      'Reliability diagrams and Brier score on a future labeled benchmark',
      'Stratify by example class from the entity-resolution specification',
      'Do not report production TrustHub confidence as if it were already audited',
    ],
    expectedDifficulty: 'advanced',
    privacyLegalConsiderations: [
      'Internal matcher scores remain INTERNAL_RESEARCH until a controlled or public benchmark exists.',
    ],
    potentialOutput: 'Calibration report template for later Academic 001B+ benchmark files.',
    irbLikely: false,
  },
  {
    id: 'information-presentation-decisions',
    title: 'Information presentation and consumer decision quality',
    academicTrack: 'public-policy-consumer-protection',
    recommendedLevel: 'capstone',
    verticals: ['cross-network'],
    researchQuestion:
      'When the same public licensing facts are presented as a narrative, a table, or a simplified badge, how do research participants change their stated caution, comprehension, and willingness to contact a provider?',
    whyItMatters:
      'Ask Trust Hub’s parent role is routing and explanation. Presentation choices can create overconfidence even when the underlying record is honest.',
    possibleDatasetIds: ['move-regulatory-identity', 'lender-nmls-company', 'insurance-agency-identity'],
    suggestedMethods: [
      'Randomized presentation of synthetic or public-record vignettes',
      'Pre-registered comprehension and caution measures',
      'No collection of unnecessary participant identifiers',
    ],
    expectedDifficulty: 'substantial',
    privacyLegalConsiderations: [
      'Human-subjects research. Institutional Review Board (IRB) review is likely required.',
      'Do not collect student or consumer PII beyond what the IRB protocol allows.',
      'Do not use the experiment as lead generation.',
    ],
    potentialOutput: 'Pre-registered experiment report. Marked as IRB-gated — not a live TrustHub test on production users.',
    irbLikely: true,
  },
] as const;

export function academicProjectsByTrack(track: AcademicProjectBrief['academicTrack']) {
  return ACADEMIC_PROJECTS.filter((p) => p.academicTrack === track);
}
