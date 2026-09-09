export const CONTROL_PLANE_HUBS = ['ask', 'move', 'lender', 'insurance', 'contractor', 'senior', 'investor'] as const;
export type ControlPlaneHub = (typeof CONTROL_PLANE_HUBS)[number];

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requiredString(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (typeof value[key] !== 'string' || value[key] === '') errors.push(`${key}:required_string`);
}

export function oneOf(value: Record<string, unknown>, key: string, allowed: readonly string[], errors: string[]): void {
  if (typeof value[key] !== 'string' || !allowed.includes(value[key] as string)) errors.push(`${key}:invalid_enum`);
}
