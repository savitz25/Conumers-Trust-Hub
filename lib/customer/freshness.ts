export const BUSINESS_FRESHNESS_CURRENT_DAYS = 180;
export const BUSINESS_FRESHNESS_STALE_DAYS = 331;

export type BusinessFreshnessState = 'CURRENT' | 'RECONFIRM_SOON' | 'STALE';

export type BusinessFreshness = {
  state: BusinessFreshnessState;
  lastConfirmedAt: string;
  label: string;
  mayBeOutdated: boolean;
};

export function businessFreshness(lastConfirmedAt: string, now = new Date()): BusinessFreshness {
  const confirmed = new Date(lastConfirmedAt);
  const ageDays = Math.max(0, Math.floor((now.getTime() - confirmed.getTime()) / 86_400_000));
  const state: BusinessFreshnessState = ageDays >= BUSINESS_FRESHNESS_STALE_DAYS
    ? 'STALE' : ageDays > BUSINESS_FRESHNESS_CURRENT_DAYS ? 'RECONFIRM_SOON' : 'CURRENT';
  const date = confirmed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return {
    state,
    lastConfirmedAt: confirmed.toISOString(),
    label: `Last confirmed ${date}${state === 'STALE' ? ' — may be outdated' : ''}`,
    mayBeOutdated: state === 'STALE',
  };
}

export function oldestConfirmation(rows: Array<{ last_confirmed_at: string }>): string | null {
  return rows.map((row) => row.last_confirmed_at).filter(Boolean).sort()[0] ?? null;
}
