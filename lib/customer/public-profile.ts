import type { BusinessFreshness } from './freshness.ts';

export const PUBLIC_BUSINESS_FIELD_KEYS = [
  'description', 'website', 'public_phone', 'public_email', 'founded_year',
  'emergency_service', 'contact_context',
] as const;

export type PublicBusinessProfile = {
  contractVersion: 1;
  hub: 'contractor';
  nativeProfileId: string;
  managed: true;
  source: 'BUSINESS_SUPPLIED';
  freshness: BusinessFreshness;
  fields: Partial<Record<(typeof PUBLIC_BUSINESS_FIELD_KEYS)[number], string>>;
  services: string[];
  serviceAreas: string[];
  languages: string[];
  hours: Array<{ weekday: number; closed: boolean; opensAt?: string; closesAt?: string }>;
};
