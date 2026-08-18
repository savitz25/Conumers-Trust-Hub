/**
 * Stage B.3 — Optional My Trust Journey metadata (Ask origin only).
 *
 * High-level non-PII coordination facts. Does NOT sync:
 * mover shortlists, loan estimates, insurance plans, notes, documents.
 *
 * Specialist My Move / My Lending / My Insurance remain source of truth.
 */

import {
  buildInsuranceDeepLink,
  buildLenderDeepLink,
  buildMoveDeepLink,
  placeLabel,
  type JourneyContext,
  type JourneyHub,
  type JourneyIntent,
  type JourneyKind,
} from '@/lib/orchestration/journey-links';
import {
  generateTrustJourneyPlan,
  type SituationId,
  type TrustJourneyPlan,
} from '@/lib/orchestration/path-generator';
import {
  loadJourneyProgress,
  makePlanKey,
  markStepVisited,
  type JourneyProgress,
} from '@/lib/orchestration/progress';

export const JOURNEY_METADATA_KEY = 'ath:my-trust-journey:v1';
export const JOURNEY_METADATA_VERSION = 1 as const;

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Specialist workspace entry points (separate products, separate logins). */
export const SPECIALIST_MY_WORKSPACES = {
  move: {
    hub: 'move' as const,
    label: 'My Move',
    href: 'https://www.movetrusthub.com/my-move',
    blurb: 'Saved mover research on Move Trust Hub',
  },
  lender: {
    hub: 'lender' as const,
    label: 'My Lending',
    href: 'https://www.lendertrusthub.com/my-lending',
    blurb: 'Saved lending research on Lender Trust Hub',
  },
  insurance: {
    hub: 'insurance' as const,
    label: 'My Insurance',
    href: 'https://www.insurancetrusthub.com/my-insurance',
    blurb: 'Saved coverage research on Insurance Trust Hub',
  },
} as const;

export type StepStatus = 'not_started' | 'visited' | 'current';

export type JourneyMetadata = {
  version: typeof JOURNEY_METADATA_VERSION;
  situationId: SituationId;
  /** High-level journey kind for copy */
  journey?: JourneyKind;
  intent?: JourneyIntent;
  stateCode?: string;
  stateSlug?: string;
  stateName?: string;
  county?: string;
  citySlug?: string;
  originStateCode?: string;
  /** Ordered step ids from last plan */
  stepIds: string[];
  /** Hubs that appear in the plan */
  hubsInPlan: JourneyHub[];
  /** Hubs the user has opened from Ask */
  hubsVisited: JourneyHub[];
  currentStepId?: string;
  planKey: string;
  createdAt: string;
  updatedAt: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

const SITUATION_SET = new Set<SituationId>([
  'move_buy',
  'move_rent',
  'buy_local',
  'refinance',
  'coverage_after_move',
  'pure_move',
  'hire_contractor',
  'aging_parent',
  'investing_research',
  'unknown',
]);

const JOURNEY_SET = new Set<JourneyKind>([
  'relocate',
  'purchase',
  'refi',
  'coverage',
  'senior_care',
  'investing',
  'contractor',
  'unknown',
]);

const INTENT_SET = new Set<JourneyIntent>(['buy', 'rent', 'refi', 'unknown']);
const HUB_SET = new Set<JourneyHub>([
  'move',
  'lender',
  'insurance',
  'contractor',
  'senior',
  'investor',
]);

function sanitizeHubs(raw: unknown): JourneyHub[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is JourneyHub => typeof h === 'string' && HUB_SET.has(h as JourneyHub))
    .slice(0, 3);
}

function sanitizeMetadata(raw: unknown): JourneyMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== JOURNEY_METADATA_VERSION) return null;
  if (typeof o.situationId !== 'string' || !SITUATION_SET.has(o.situationId as SituationId))
    return null;
  if (typeof o.planKey !== 'string' || typeof o.updatedAt !== 'string') return null;
  if (typeof o.createdAt !== 'string') return null;
  const updated = Date.parse(o.updatedAt);
  if (!Number.isFinite(updated) || Date.now() - updated > MAX_AGE_MS) return null;

  const journey =
    typeof o.journey === 'string' && JOURNEY_SET.has(o.journey as JourneyKind)
      ? (o.journey as JourneyKind)
      : undefined;
  const intent =
    typeof o.intent === 'string' && INTENT_SET.has(o.intent as JourneyIntent)
      ? (o.intent as JourneyIntent)
      : undefined;

  const stepIds = Array.isArray(o.stepIds)
    ? o.stepIds.filter((x): x is string => typeof x === 'string').slice(0, 12)
    : [];

  return {
    version: JOURNEY_METADATA_VERSION,
    situationId: o.situationId as SituationId,
    journey,
    intent,
    stateCode:
      typeof o.stateCode === 'string' ? o.stateCode.slice(0, 2).toUpperCase() : undefined,
    stateSlug:
      typeof o.stateSlug === 'string' ? o.stateSlug.slice(0, 48) : undefined,
    stateName:
      typeof o.stateName === 'string' ? o.stateName.slice(0, 64) : undefined,
    county:
      typeof o.county === 'string'
        ? o.county
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .slice(0, 80)
        : undefined,
    citySlug:
      typeof o.citySlug === 'string' ? o.citySlug.slice(0, 48) : undefined,
    originStateCode:
      typeof o.originStateCode === 'string'
        ? o.originStateCode.slice(0, 2).toUpperCase()
        : undefined,
    stepIds,
    hubsInPlan: sanitizeHubs(o.hubsInPlan),
    hubsVisited: sanitizeHubs(o.hubsVisited),
    currentStepId:
      typeof o.currentStepId === 'string' ? o.currentStepId.slice(0, 64) : undefined,
    planKey: o.planKey.slice(0, 120),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function loadJourneyMetadata(): JourneyMetadata | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(JOURNEY_METADATA_KEY);
    if (!raw) return null;
    return sanitizeMetadata(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveJourneyMetadata(meta: JourneyMetadata): JourneyMetadata | null {
  if (!isBrowser()) return null;
  try {
    const cleaned = sanitizeMetadata(meta);
    if (!cleaned) return null;
    localStorage.setItem(JOURNEY_METADATA_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch {
    return null;
  }
}

/**
 * Persist high-level plan metadata when user builds a path (B.2 planner).
 * Preserves hubsVisited when planKey matches.
 */
export function upsertMetadataFromPlan(
  plan: TrustJourneyPlan,
  extras?: { originStateCode?: string; citySlug?: string }
): JourneyMetadata | null {
  const planKey = makePlanKey({
    situationId: plan.situationId,
    stateCode: plan.context.stateCode,
    county: plan.context.county,
  });
  const existing = loadJourneyMetadata();
  const now = new Date().toISOString();
  const samePlan = existing?.planKey === planKey;

  const next: JourneyMetadata = {
    version: JOURNEY_METADATA_VERSION,
    situationId: plan.situationId,
    journey: plan.context.journey,
    intent: plan.context.intent,
    stateCode: plan.context.stateCode,
    stateSlug: plan.context.stateSlug,
    stateName: plan.context.stateName,
    county: plan.context.county,
    citySlug: extras?.citySlug ?? plan.context.citySlug,
    originStateCode: extras?.originStateCode,
    stepIds: plan.steps.map((s) => s.id),
    hubsInPlan: [...new Set(plan.steps.map((s) => s.hub))],
    hubsVisited: samePlan ? existing?.hubsVisited ?? [] : [],
    currentStepId: samePlan
      ? existing?.currentStepId ?? plan.steps[0]?.id
      : plan.steps[0]?.id,
    planKey,
    createdAt: samePlan && existing ? existing.createdAt : now,
    updatedAt: now,
  };

  return saveJourneyMetadata(next);
}

/** Mark hub + step visited when user continues from overview or planner. */
export function recordHubVisit(
  stepId: string,
  hub: JourneyHub
): JourneyMetadata | null {
  const meta = loadJourneyMetadata();
  if (!meta) return null;

  const hubsVisited = meta.hubsVisited.includes(hub)
    ? meta.hubsVisited
    : [...meta.hubsVisited, hub].slice(0, 3);

  const idx = meta.stepIds.indexOf(stepId);
  const nextStepId =
    idx >= 0 && idx < meta.stepIds.length - 1
      ? meta.stepIds[idx + 1]
      : stepId;

  const next: JourneyMetadata = {
    ...meta,
    hubsVisited,
    currentStepId: nextStepId,
    updatedAt: new Date().toISOString(),
  };

  markStepVisited(meta.planKey, stepId);
  return saveJourneyMetadata(next);
}

export function clearJourneyMetadata(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(JOURNEY_METADATA_KEY);
  } catch {
    /* ignore */
  }
}

export function rebuildPlanFromMetadata(
  meta: JourneyMetadata
): TrustJourneyPlan {
  return generateTrustJourneyPlan({
    situationId: meta.situationId,
    state: meta.stateCode ?? meta.stateSlug,
    county: meta.county,
    citySlug: meta.citySlug,
    originState: meta.originStateCode,
    intent: meta.intent,
  });
}

export function contextFromMetadata(meta: JourneyMetadata): JourneyContext {
  return {
    src: 'ask',
    journey: meta.journey,
    intent: meta.intent,
    stateCode: meta.stateCode,
    stateSlug: meta.stateSlug,
    stateName: meta.stateName,
    county: meta.county,
    citySlug: meta.citySlug,
  };
}

export function situationSummaryLine(meta: JourneyMetadata): string {
  const place =
    placeLabel(contextFromMetadata(meta)) ??
    meta.stateName ??
    meta.stateCode ??
    null;
  const intent =
    meta.intent === 'buy'
      ? 'may buy'
      : meta.intent === 'rent'
        ? 'renting'
        : meta.intent === 'refi'
          ? 'refinancing'
          : null;

  if (place && intent) return `${place} · ${intent}`;
  if (place) return place;
  if (intent) return intent;
  return 'Research in progress';
}

export function currentStepLabel(
  plan: TrustJourneyPlan,
  meta: JourneyMetadata,
  progress: JourneyProgress | null
): string {
  const visited = new Set(
    progress?.planKey === meta.planKey ? progress.visitedStepIds : []
  );
  const total = plan.steps.length;
  if (total === 0) return 'No steps yet';

  let currentIdx = 0;
  for (let i = 0; i < plan.steps.length; i++) {
    if (!visited.has(plan.steps[i].id)) {
      currentIdx = i;
      break;
    }
    currentIdx = Math.min(i + 1, total - 1);
  }

  // If all visited, show last
  if (plan.steps.every((s) => visited.has(s.id))) {
    return `Step ${total} of ${total} · complete`;
  }

  const step = plan.steps[currentIdx];
  const hubWord =
    step.hub === 'lender'
      ? 'Financing'
      : step.hub === 'insurance'
        ? 'Coverage'
        : 'Moving';
  return `Step ${step.step} of ${total} · ${hubWord}`;
}

export function stepStatus(
  stepId: string,
  plan: TrustJourneyPlan,
  meta: JourneyMetadata,
  visited: Set<string>
): StepStatus {
  if (visited.has(stepId)) return 'visited';
  // First unvisited is current
  for (const s of plan.steps) {
    if (!visited.has(s.id)) {
      return s.id === stepId ? 'current' : 'not_started';
    }
  }
  return stepId === meta.currentStepId ? 'current' : 'not_started';
}

export function specialistContinues(meta: JourneyMetadata): {
  hub: JourneyHub;
  label: string;
  href: string;
  blurb: string;
}[] {
  const ctx = contextFromMetadata(meta);
  const items: {
    hub: JourneyHub;
    label: string;
    href: string;
    blurb: string;
  }[] = [];

  const hubs = meta.hubsInPlan.length
    ? meta.hubsInPlan
    : (['move', 'lender', 'insurance'] as JourneyHub[]);

  for (const hub of hubs) {
    if (!(hub in SPECIALIST_MY_WORKSPACES)) continue;
    const my = SPECIALIST_MY_WORKSPACES[hub as keyof typeof SPECIALIST_MY_WORKSPACES];
    items.push({
      hub,
      label: my.label,
      href: my.href,
      blurb: my.blurb,
    });
  }

  // Research continues (contextual)
  return items;
}

export function researchContinueLinks(meta: JourneyMetadata): {
  label: string;
  href: string;
  hub: JourneyHub;
}[] {
  const ctx = contextFromMetadata(meta);
  const links: { label: string; href: string; hub: JourneyHub }[] = [];
  if (meta.hubsInPlan.includes('move') || meta.situationId.startsWith('move')) {
    links.push({
      label: 'Continue destination research',
      href: buildMoveDeepLink(ctx),
      hub: 'move',
    });
  }
  if (meta.hubsInPlan.includes('lender') || meta.intent === 'buy' || meta.intent === 'refi') {
    links.push({
      label: 'Continue mortgage research',
      href: buildLenderDeepLink(ctx),
      hub: 'lender',
    });
  }
  if (meta.hubsInPlan.includes('insurance')) {
    links.push({
      label: 'Continue coverage research',
      href: buildInsuranceDeepLink(ctx),
      hub: 'insurance',
    });
  }
  return links;
}

/** Load progress aligned to metadata planKey. */
export function progressForMetadata(meta: JourneyMetadata): JourneyProgress | null {
  const p = loadJourneyProgress();
  if (!p || p.planKey !== meta.planKey) return null;
  return p;
}
