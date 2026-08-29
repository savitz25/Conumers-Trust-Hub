import type { EvidenceAtlasCell, EvidenceFamilyId } from './evidence-atlas.ts';
import type { SpecialistHubId } from './registry.ts';

type Cell = Omit<EvidenceAtlasCell, 'hubId'> & { hubId: SpecialistHubId };

/**
 * Production evidence-depth audit 2026-08-29.
 * Status is categorical. No percentages as quality scores.
 */
const ROWS: Cell[] = [
  { hubId: 'move', familyId: 'identity', status: 'partial', why: 'USDOT, MC, and legal name on published directory profiles. Not a complete FMCSA census.', destination: 'https://www.movetrusthub.com/companies', sourceFamilyId: 'fmcsa-directory-cohort' },
  { hubId: 'move', familyId: 'credential', status: 'available', why: 'FMCSA authority_active flag on directory profiles. Active is not an endorsement. Null is unknown.', destination: 'https://www.movetrusthub.com/verify-dot', sourceFamilyId: 'fmcsa-directory-cohort' },
  { hubId: 'move', familyId: 'licensing', status: 'partial', why: 'Florida FDACS IM/broker registrations on /florida. Not a national registration census.', destination: 'https://www.movetrusthub.com/florida', sourceFamilyId: 'fdacs-florida' },
  { hubId: 'move', familyId: 'registration', status: 'partial', why: 'Florida IM registration is state registration, not federal interstate authority.', destination: 'https://www.movetrusthub.com/florida', sourceFamilyId: 'fdacs-florida' },
  { hubId: 'move', familyId: 'ownership', status: 'planned', why: 'Not a national homepage ownership census.', destination: 'https://www.movetrusthub.com' },
  { hubId: 'move', familyId: 'market_activity', status: 'not_applicable', why: 'MoveTrustHub is identity/authority research, not a volume marketplace.' },
  { hubId: 'move', familyId: 'complaints', status: 'planned', why: 'No immutable dated national complaint series is published on the homepage. A complaint is not wrongdoing.' },
  { hubId: 'move', familyId: 'enforcement', status: 'planned', why: 'FDACS complaint/enforcement extracts are not loaded on Florida intelligence.' },
  { hubId: 'move', familyId: 'inspection', status: 'planned', why: 'Inspection volume is not quality. No attributed national inspection census is homepage-ready.' },
  { hubId: 'move', familyId: 'staffing_quality', status: 'not_applicable', why: 'Not a CMS-style quality program for movers.' },
  { hubId: 'move', familyId: 'compensation', status: 'not_applicable', why: 'Not Form ADV compensation research.' },
  { hubId: 'move', familyId: 'pricing', status: 'not_applicable', why: 'MoveTrustHub does not publish mover prices or rankings.' },
  { hubId: 'move', familyId: 'permits', status: 'not_applicable', why: 'Not a building-permit research hub.' },
  { hubId: 'move', familyId: 'local_regulatory', status: 'partial', why: 'Florida state intelligence is live. County Enhanced Local Research is not nationally activated.', destination: 'https://www.movetrusthub.com/florida' },

  { hubId: 'lender', familyId: 'identity', status: 'deep', why: '14,623 canonical institution identities in the specialist graph. Public profiles are a smaller controlled cohort.', destination: 'https://www.lendertrusthub.com/lender', sourceFamilyId: 'nmls-consumer-access' },
  { hubId: 'lender', familyId: 'credential', status: 'available', why: 'NMLS institution identifiers on the graph. NMLS is a credential slot, not an MLO or a recommendation.', destination: 'https://www.nmlsconsumeraccess.org/', sourceFamilyId: 'nmls-consumer-access' },
  { hubId: 'lender', familyId: 'licensing', status: 'partial', why: 'Florida OFR Chapter 494 company credentials on /florida. Other states vary.', destination: 'https://www.lendertrusthub.com/florida' },
  { hubId: 'lender', familyId: 'registration', status: 'partial', why: 'Depository structure (FDIC/NCUA/nonbank) on intelligence snapshots. Not a ranking.', destination: 'https://www.lendertrusthub.com' },
  { hubId: 'lender', familyId: 'ownership', status: 'partial', why: 'Holding-company / servicer identity remains limited. BELONGS_TO is not inferred.' },
  { hubId: 'lender', familyId: 'market_activity', status: 'available', why: 'HMDA 2025 county-grain applications/originations. HMDA is not every mortgage and is not an approval rate.', destination: 'https://www.lendertrusthub.com', sourceFamilyId: 'hmda' },
  { hubId: 'lender', familyId: 'complaints', status: 'partial', why: 'CFPB mortgage complaint observations. A complaint is not a violation. Attachment is incomplete.', destination: 'https://www.lendertrusthub.com', sourceFamilyId: 'cfpb-complaints' },
  { hubId: 'lender', familyId: 'enforcement', status: 'partial', why: 'Federal enforcement observations exist. Florida OFR FLAIO company events on /florida.', destination: 'https://www.lendertrusthub.com/florida' },
  { hubId: 'lender', familyId: 'inspection', status: 'not_applicable', why: 'Not a CMS inspection program.' },
  { hubId: 'lender', familyId: 'staffing_quality', status: 'not_applicable', why: 'Not a CMS quality program.' },
  { hubId: 'lender', familyId: 'compensation', status: 'not_applicable', why: 'Not Form ADV compensation research.' },
  { hubId: 'lender', familyId: 'pricing', status: 'planned', why: 'Pricing detail is not currently available in the published Ask research contract. Homepage V1 pricing is deferred.', destination: 'https://www.lendertrusthub.com/tools/loan-estimate-analyzer' },
  { hubId: 'lender', familyId: 'permits', status: 'not_applicable', why: 'Not a permit research hub.' },
  { hubId: 'lender', familyId: 'local_regulatory', status: 'partial', why: 'Florida OFR company licensing. County market pages are not published on the intelligence page.', destination: 'https://www.lendertrusthub.com/florida' },

  { hubId: 'insurance', familyId: 'identity', status: 'partial', why: 'Agency, person, and legal-insurer classes exist in the graph. Public people and public legal-insurer pages = 0.', destination: 'https://www.insurancetrusthub.com/directory', sourceFamilyId: 'state-doi' },
  { hubId: 'insurance', familyId: 'credential', status: 'available', why: 'State DOI credential rows for included source states. A credential is not an appointment.', destination: 'https://www.insurancetrusthub.com/directory', sourceFamilyId: 'state-doi' },
  { hubId: 'insurance', familyId: 'licensing', status: 'available', why: 'Lines of authority are source-limited and not one national codebook.', destination: 'https://www.insurancetrusthub.com', sourceFamilyId: 'naic' },
  { hubId: 'insurance', familyId: 'registration', status: 'partial', why: 'CMS Marketplace observations are a federal overlay, not a state license.', destination: 'https://www.insurancetrusthub.com', sourceFamilyId: 'cms-medicare-edu' },
  { hubId: 'insurance', familyId: 'ownership', status: 'partial', why: 'Appointment edges exist. Appointment is not employment and is not NAIC identity.' },
  { hubId: 'insurance', familyId: 'market_activity', status: 'partial', why: 'Florida OIR MIR residential extract is state intelligence, not a national market ranking.', destination: 'https://www.insurancetrusthub.com/florida' },
  { hubId: 'insurance', familyId: 'complaints', status: 'planned', why: 'Complaint observations exist as INTERNAL_ONLY on the specialist. Not a national enforcement census.' },
  { hubId: 'insurance', familyId: 'enforcement', status: 'planned', why: 'Florida regulatory catalogs are not firm history without exact identity.' },
  { hubId: 'insurance', familyId: 'inspection', status: 'not_applicable', why: 'Not a CMS inspection program.' },
  { hubId: 'insurance', familyId: 'staffing_quality', status: 'not_applicable', why: 'Not a CMS quality program.' },
  { hubId: 'insurance', familyId: 'compensation', status: 'not_applicable', why: 'Not Form ADV compensation research.' },
  { hubId: 'insurance', familyId: 'pricing', status: 'planned', why: 'Pricing detail is not currently available in the published Ask research contract. CHOICES sample premiums are not quotes.' },
  { hubId: 'insurance', familyId: 'permits', status: 'not_applicable', why: 'Not a permit research hub.' },
  { hubId: 'insurance', familyId: 'local_regulatory', status: 'planned', why: 'No county market inference from addresses or appointments.' },

  { hubId: 'contractor', familyId: 'identity', status: 'available', why: 'State-configured official license/registration extracts in 10 live states.', destination: 'https://www.contractortrusthub.com/verify', sourceFamilyId: 'state-contractor-boards' },
  { hubId: 'contractor', familyId: 'credential', status: 'available', why: 'Board status where the extract includes it. Active is not endorsement.', destination: 'https://www.contractortrusthub.com/verify', sourceFamilyId: 'state-contractor-boards' },
  { hubId: 'contractor', familyId: 'licensing', status: 'available', why: 'State-specific occupation/class codes. Roofing in Florida is CCC+RC, not RR.', destination: 'https://www.contractortrusthub.com/verify', sourceFamilyId: 'fl-dbpr' },
  { hubId: 'contractor', familyId: 'registration', status: 'partial', why: 'Washington is L&I registration, not a Florida-style CILB license.' },
  { hubId: 'contractor', familyId: 'ownership', status: 'partial', why: 'Florida Sunbiz high-confidence links only. Unknown ownership is not independence.', destination: 'https://www.contractortrusthub.com/florida' },
  { hubId: 'contractor', familyId: 'market_activity', status: 'partial', why: 'Trade-family credential counts in live states. Not a national trade census.', destination: 'https://www.contractortrusthub.com' },
  { hubId: 'contractor', familyId: 'complaints', status: 'planned', why: 'Complaints fail closed on Ask. A complaint is not a finding.' },
  { hubId: 'contractor', familyId: 'enforcement', status: 'partial', why: 'Florida DBPR/DFS families researched; other states vary. Families are not one severity score.', destination: 'https://www.contractortrusthub.com/florida' },
  { hubId: 'contractor', familyId: 'inspection', status: 'planned', why: 'Not a national inspection census.' },
  { hubId: 'contractor', familyId: 'staffing_quality', status: 'not_applicable', why: 'Not a CMS quality program.' },
  { hubId: 'contractor', familyId: 'compensation', status: 'not_applicable', why: 'Not Form ADV compensation research.' },
  { hubId: 'contractor', familyId: 'pricing', status: 'not_applicable', why: 'Quote tools are educational. Not a price ranking.' },
  { hubId: 'contractor', familyId: 'permits', status: 'planned', why: 'Selected Florida local research only. Missing export is not zero events.', destination: 'https://www.contractortrusthub.com/florida/broward' },
  { hubId: 'contractor', familyId: 'local_regulatory', status: 'partial', why: 'Broward and Palm Beach county intelligence pages exist. HQ/mailing county is not service area.', destination: 'https://www.contractortrusthub.com/florida/broward', sourceFamilyId: 'fl-dbpr' },

  { hubId: 'senior', familyId: 'identity', status: 'deep', why: 'CMS CCN identities by class: nursing homes, home health, hospice stay separate.', destination: 'https://www.seniortrusthub.com', sourceFamilyId: 'cms-care-compare' },
  { hubId: 'senior', familyId: 'credential', status: 'available', why: 'CMS provider identity is the credential key. Assisted living is not a CMS national class.', destination: 'https://www.seniortrusthub.com', sourceFamilyId: 'cms-care-compare' },
  { hubId: 'senior', familyId: 'licensing', status: 'partial', why: 'Florida AHCA overlays on /florida. Most states have CMS directory only.', destination: 'https://www.seniortrusthub.com/florida' },
  { hubId: 'senior', familyId: 'registration', status: 'available', why: 'Current CMS class directories.', destination: 'https://www.seniortrusthub.com', sourceFamilyId: 'cms-care-compare' },
  { hubId: 'senior', familyId: 'ownership', status: 'partial', why: 'CURRENT OWNED_BY evidence is uneven by class. UNKNOWN is not a clean history. CHOW exists for nursing homes only.', destination: 'https://www.seniortrusthub.com', sourceFamilyId: 'cms-care-compare' },
  { hubId: 'senior', familyId: 'market_activity', status: 'not_applicable', why: 'Not HMDA-style market volume research.' },
  { hubId: 'senior', familyId: 'complaints', status: 'planned', why: 'Not a national complaint ranking.' },
  { hubId: 'senior', familyId: 'enforcement', status: 'partial', why: 'Nursing Home inspection/penalty families exist. Home Health and Hospice lack those same national files on this hub.', destination: 'https://www.seniortrusthub.com', sourceFamilyId: 'cms-care-compare' },
  { hubId: 'senior', familyId: 'inspection', status: 'partial', why: 'Nursing Home survey/deficiency files. Not interchangeable with Home Health or Hospice.', destination: 'https://www.seniortrusthub.com', sourceFamilyId: 'cms-care-compare' },
  { hubId: 'senior', familyId: 'staffing_quality', status: 'partial', why: 'CMS stars are CMS ratings for a specific program. Hospice has no overall star in this directory. Stars are not TrustHub rankings.', destination: 'https://www.seniortrusthub.com', sourceFamilyId: 'cms-care-compare' },
  { hubId: 'senior', familyId: 'compensation', status: 'not_applicable', why: 'Not Form ADV compensation research.' },
  { hubId: 'senior', familyId: 'pricing', status: 'planned', why: 'Cost planner tools are educational estimates, not a published price census.' },
  { hubId: 'senior', familyId: 'permits', status: 'not_applicable', why: 'Not a permit research hub.' },
  { hubId: 'senior', familyId: 'local_regulatory', status: 'partial', why: 'Florida AHCA identities and regulatory observations. Other states: CMS only.', destination: 'https://www.seniortrusthub.com/florida' },

  { hubId: 'investor', familyId: 'identity', status: 'deep', why: 'Organization CRD is the firm identity key on the SEC/IARD roster.', destination: 'https://www.investortrusthub.com/firms', sourceFamilyId: 'sec-iard-adv' },
  { hubId: 'investor', familyId: 'credential', status: 'deep', why: 'RIA vs ERA classification. ERA is not an RIA. Registration is not endorsement.', destination: 'https://www.investortrusthub.com/firms', sourceFamilyId: 'sec-iard-adv' },
  { hubId: 'investor', familyId: 'licensing', status: 'available', why: 'Reported registration class and source status text, not approval.', destination: 'https://www.investortrusthub.com', sourceFamilyId: 'sec-iard-adv' },
  { hubId: 'investor', familyId: 'registration', status: 'deep', why: 'Current monthly SEC IARD roster (RIA + ERA).', destination: 'https://www.investortrusthub.com', sourceFamilyId: 'sec-iard-adv' },
  { hubId: 'investor', familyId: 'ownership', status: 'partial', why: 'Ownership/control is confidence-gated on profiles. Not a homepage headcount.', destination: 'https://www.investortrusthub.com/firms', sourceFamilyId: 'sec-iard-adv' },
  { hubId: 'investor', familyId: 'market_activity', status: 'available', why: 'Reported RAUM bands for RIAs only. RAUM is not performance and is not summed nationally.', destination: 'https://www.investortrusthub.com', sourceFamilyId: 'sec-iard-adv' },
  { hubId: 'investor', familyId: 'complaints', status: 'planned', why: 'Item 11 is a filer checkbox, not an enforcement-event count. disclosure_events = 0.' },
  { hubId: 'investor', familyId: 'enforcement', status: 'planned', why: 'No national enforcement-event census in disclosure_events. Missing is not a clean record.' },
  { hubId: 'investor', familyId: 'inspection', status: 'not_applicable', why: 'Not a CMS inspection program.' },
  { hubId: 'investor', familyId: 'staffing_quality', status: 'not_applicable', why: 'Not a CMS quality program.' },
  { hubId: 'investor', familyId: 'compensation', status: 'available', why: 'Form ADV Item 5.E Y/N methods for RIAs. Not dollar rates and not a fee-only badge.', destination: 'https://www.investortrusthub.com', sourceFamilyId: 'sec-iard-adv' },
  { hubId: 'investor', familyId: 'pricing', status: 'not_applicable', why: 'Item 5.E is method, not price. No published fee census.' },
  { hubId: 'investor', familyId: 'permits', status: 'not_applicable', why: 'Not a permit research hub.' },
  { hubId: 'investor', familyId: 'local_regulatory', status: 'planned', why: 'Principal-office state is not notice-filing authority or service territory.' },
];

export function evidenceAtlasCells(): EvidenceAtlasCell[] {
  return ROWS;
}

export function evidenceCell(hubId: SpecialistHubId, familyId: EvidenceFamilyId): EvidenceAtlasCell | undefined {
  return ROWS.find((r) => r.hubId === hubId && r.familyId === familyId);
}
