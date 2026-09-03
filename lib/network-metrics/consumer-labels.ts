/** Public State of the Network labels. Grain and denominator stay in Trace. */
export const CONSUMER_METRIC_LABELS: Record<string, string> = {
  move_public_profiles: 'Published moving companies',
  move_authority_recorded: 'Moving companies with current authority',
  lender_institutions: 'Lenders & lending institutions',
  insurance_agencies: 'Insurance agencies',
  insurance_legal_insurers: 'Licensed insurance companies',
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
  'move_public_profiles',
  'move_authority_recorded',
  'lender_institutions',
  'insurance_agencies',
  'insurance_legal_insurers',
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
