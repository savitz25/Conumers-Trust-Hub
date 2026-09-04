/** Public State of the Network labels. Grain and denominator stay in Trace. */
export const CONSUMER_METRIC_LABELS: Record<string, string> = {
  move_public_profiles: 'Published moving companies',
  move_authority_recorded: 'Moving companies with current authority',
  federal_publishable_directory_profiles: 'Published moving companies',
  federal_directory_authority_active: 'Moving companies with current authority',
  florida_fdacs_im_active_registrations: 'Active Florida intrastate mover registrations',
  lender_institutions: 'Lenders & lending institutions',
  lenders_lending_institutions: 'Lenders & lending institutions',
  hmda_2025_county_applications: 'HMDA applications',
  hmda_2025_county_originations: 'HMDA originations',
  cfpb_mortgage_complaint_observations: 'Consumer complaint observations',
  federal_enforcement_events: 'Federal enforcement observations',
  nmls_institution_identifiers: 'NMLS institution identifiers',
  insurance_agencies: 'Insurance agencies',
  insurance_legal_insurers: 'Licensed insurance companies',
  licensed_insurance_companies: 'Licensed insurance companies',
  insurance_producer_records: 'Insurance producer records',
  cms_marketplace_evidence_observations: 'CMS Marketplace evidence observations',
  appointments: 'Appointments',
  consumer_complaint_observations: 'Consumer complaint observations',
  rate_filing_observations: 'Rate filing observations',
  market_conduct_examinations: 'Market conduct examinations',
  contractor_live_credentials: 'Contractor license records',
  contractor_active_credentials: 'Active/current contractor licenses',
  live_credential_records: 'Contractor license records',
  live_active_current_credential_records: 'Active/current contractor licenses',
  investor_iard_roster: 'Investment advisory firms',
  investor_ria_firms: 'Registered investment adviser records',
  investor_era_firms: 'Exempt reporting adviser records',
  current_nursing_homes: 'Current nursing homes',
  current_home_health_agencies: 'Current home health agencies',
  current_hospice_providers: 'Current hospice providers',
};

export const HOMEPAGE_PUBLIC_METRIC_IDS = [
  'investor_iard_roster',
  'investor_ria_firms',
  'investor_era_firms',
] as const;

export function consumerMetricLabel(id: string, fallback: string): string {
  return CONSUMER_METRIC_LABELS[id] ?? fallback;
}

export function isInternalPublicNoun(label: string): boolean {
  return /\bcanonical\b|contracting companies|published mover identities|published identities with current|legal insurers|public live credential|sec\/iard roster firms|\bria facts\b|\bera facts\b/i.test(
    label,
  );
}
