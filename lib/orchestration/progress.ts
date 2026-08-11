/**
 * Stage B.2 — lightweight visited-step progress on Ask origin only.
 * No accounts, no PII, fail soft if storage blocked.
 */

const KEY = 'ath:ask-journey-progress:v1';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type JourneyProgress = {
  version: 1;
  /** plan key = situationId + state + county */
  planKey: string;
  visitedStepIds: string[];
  updatedAt: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function planKeyFrom(parts: {
  situationId: string;
  stateCode?: string;
  county?: string;
}): string {
  return [parts.situationId, parts.stateCode ?? '', parts.county ?? ''].join('|');
}

export function makePlanKey(parts: {
  situationId: string;
  stateCode?: string;
  county?: string;
}): string {
  return planKeyFrom(parts);
}

function sanitize(raw: unknown): JourneyProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.planKey !== 'string' || typeof o.updatedAt !== 'string') return null;
  const t = Date.parse(o.updatedAt);
  if (!Number.isFinite(t) || Date.now() - t > MAX_AGE_MS) return null;
  const visited = Array.isArray(o.visitedStepIds)
    ? o.visitedStepIds.filter((x): x is string => typeof x === 'string').slice(0, 12)
    : [];
  return {
    version: 1,
    planKey: o.planKey,
    visitedStepIds: visited,
    updatedAt: o.updatedAt,
  };
}

export function loadJourneyProgress(): JourneyProgress | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function markStepVisited(
  planKey: string,
  stepId: string
): JourneyProgress | null {
  if (!isBrowser()) return null;
  try {
    const existing = loadJourneyProgress();
    const visited =
      existing?.planKey === planKey ? [...existing.visitedStepIds] : [];
    if (!visited.includes(stepId)) visited.push(stepId);
    const next: JourneyProgress = {
      version: 1,
      planKey,
      visitedStepIds: visited.slice(0, 12),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function visitedSetForPlan(planKey: string): Set<string> {
  const p = loadJourneyProgress();
  if (!p || p.planKey !== planKey) return new Set();
  return new Set(p.visitedStepIds);
}

export function clearJourneyProgress(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
