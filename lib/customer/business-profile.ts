export const BUSINESS_FIELD_KEYS = [
  'description', 'website', 'public_phone', 'public_email', 'founded_year',
  'emergency_service', 'contact_context',
] as const;

export type BusinessFieldKey = (typeof BUSINESS_FIELD_KEYS)[number];
export type BusinessProfileInput = {
  version: number;
  fields: Partial<Record<BusinessFieldKey, string>>;
  services: string[];
  serviceAreas: string[];
  languages: string[];
  hours: Array<{ weekday: number; closed: boolean; opensAt?: string; closesAt?: string }>;
};

export class BusinessProfileValidationError extends Error {
  readonly issues: Record<string, string>;
  constructor(issues: Record<string, string>) {
    super('business_profile_validation_failed');
    this.name = 'BusinessProfileValidationError';
    this.issues = issues;
  }
}

const LIMITS: Record<BusinessFieldKey, number> = {
  description: 2000,
  website: 300,
  public_phone: 40,
  public_email: 254,
  founded_year: 4,
  emergency_service: 5,
  contact_context: 500,
};

function cleanText(value: unknown, max: number, label: string, issues: Record<string, string>): string {
  if (typeof value !== 'string') { issues[label] = 'Must be text.'; return ''; }
  const result = value.trim().replace(/\r\n/g, '\n');
  if (/[<>]/.test(result)) issues[label] = 'HTML and markup are not allowed.';
  if (result.length > max) issues[label] = `Must be ${max} characters or fewer.`;
  return result;
}

function cleanList(value: unknown, label: string, issues: Record<string, string>): string[] {
  if (!Array.isArray(value) || value.length > 30) { issues[label] = 'Use no more than 30 entries.'; return []; }
  const out = value.map((v, i) => cleanText(v, 80, `${label}.${i}`, issues)).filter(Boolean);
  return [...new Set(out.map((v) => v.replace(/\s+/g, ' ')))];
}

export function validateBusinessProfile(input: unknown, now = new Date()): BusinessProfileInput {
  const issues: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BusinessProfileValidationError({ form: 'Invalid request.' });
  const raw = input as Record<string, unknown>;
  const version = Number(raw.version);
  if (!Number.isInteger(version) || version < 0) issues.version = 'Invalid version.';
  const rawFields = raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields)
    ? raw.fields as Record<string, unknown> : {};
  for (const key of Object.keys(rawFields)) {
    if (!BUSINESS_FIELD_KEYS.includes(key as BusinessFieldKey)) issues[key] = 'Unknown field.';
  }
  const fields: Partial<Record<BusinessFieldKey, string>> = {};
  for (const key of BUSINESS_FIELD_KEYS) {
    const value = cleanText(rawFields[key] ?? '', LIMITS[key], key, issues);
    if (value) fields[key] = value;
  }
  if (fields.website) {
    try { const u = new URL(fields.website); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); fields.website = u.toString(); }
    catch { issues.website = 'Enter a complete http:// or https:// URL.'; }
  }
  if (fields.public_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.public_email)) issues.public_email = 'Enter a valid email address.';
  if (fields.public_phone && !/^\+?[0-9().\-\s]{7,40}$/.test(fields.public_phone)) issues.public_phone = 'Enter a valid public phone number.';
  if (fields.founded_year) {
    const year = Number(fields.founded_year);
    if (!Number.isInteger(year) || year < 1800 || year > now.getUTCFullYear()) issues.founded_year = 'Enter a valid founded year.';
  }
  if (fields.emergency_service && !['true', 'false'].includes(fields.emergency_service)) issues.emergency_service = 'Choose yes or no.';
  const services = cleanList(raw.services, 'services', issues);
  const serviceAreas = cleanList(raw.serviceAreas, 'serviceAreas', issues);
  const languages = cleanList(raw.languages, 'languages', issues);
  const hoursRaw = Array.isArray(raw.hours) ? raw.hours : [];
  if (hoursRaw.length > 7) issues.hours = 'Use at most one schedule per weekday.';
  const days = new Set<number>();
  const hours = hoursRaw.map((entry, i) => {
    const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const weekday = Number(row.weekday);
    const closed = row.closed === true;
    const opensAt = typeof row.opensAt === 'string' ? row.opensAt : undefined;
    const closesAt = typeof row.closesAt === 'string' ? row.closesAt : undefined;
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || days.has(weekday)) issues[`hours.${i}`] = 'Invalid or duplicate weekday.';
    days.add(weekday);
    if (!closed && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(opensAt || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(closesAt || '') || opensAt! >= closesAt!)) issues[`hours.${i}`] = 'Opening time must be before closing time.';
    return { weekday, closed, opensAt: closed ? undefined : opensAt, closesAt: closed ? undefined : closesAt };
  });
  if (Object.keys(issues).length) throw new BusinessProfileValidationError(issues);
  return { version, fields, services, serviceAreas, languages, hours };
}
