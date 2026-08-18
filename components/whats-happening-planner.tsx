'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, MapPin, Route } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import {
  MOVE_CITY_HUBS,
  US_STATES,
  type JourneyHub,
  type JourneyIntent,
} from '@/lib/orchestration/journey-links';
import {
  generateTrustJourneyPlan,
  SITUATION_OPTIONS,
  type SituationId,
  type TrustJourneyPlan,
} from '@/lib/orchestration/path-generator';
import {
  recordHubVisit,
  upsertMetadataFromPlan,
} from '@/lib/orchestration/journey-metadata';
import {
  makePlanKey,
  markStepVisited,
  visitedSetForPlan,
} from '@/lib/orchestration/progress';
import { cn } from '@/lib/utils';

const HUB_ACCENT: Record<JourneyHub, string> = {
  move: '#C2410C',
  lender: '#166534',
  insurance: '#0F766E',
  contractor: '#0A2540',
  senior: '#6D28D9',
  investor: '#001F52',
};

type Props = {
  className?: string;
  /** Preselect situation from URL or parent */
  initialSituation?: SituationId;
};

/**
 * Stage B.2 — “What’s happening?” → multi-hub Trust Journey plan.
 * Research orchestration only; no accounts, no PII, Stage A′ deep links.
 */
export function WhatsHappeningPlanner({ className, initialSituation }: Props) {
  const [situationId, setSituationId] = useState<SituationId>(
    initialSituation ?? 'move_buy'
  );
  const [stateCode, setStateCode] = useState('FL');
  const [county, setCounty] = useState('');
  const [citySlug, setCitySlug] = useState('');
  const [originCode, setOriginCode] = useState('');
  const [intent, setIntent] = useState<JourneyIntent>('unknown');
  const [plan, setPlan] = useState<TrustJourneyPlan | null>(null);
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const situation = SITUATION_OPTIONS.find((s) => s.id === situationId)!;

  const buildPlan = useCallback(
    (persist: boolean) => {
      const next = generateTrustJourneyPlan({
        situationId,
        state: situation.needsDestination ? stateCode || undefined : stateCode || undefined,
        county: county || undefined,
        citySlug: citySlug || undefined,
        originState: originCode || undefined,
        intent,
      });
      setPlan(next);
      const key = makePlanKey({
        situationId: next.situationId,
        stateCode: next.context.stateCode,
        county: next.context.county,
      });
      setVisited(visitedSetForPlan(key));
      // Stage B.3 — only persist when user explicitly builds (not on passive preview)
      if (persist) {
        upsertMetadataFromPlan(next, {
          originStateCode: originCode || undefined,
          citySlug: citySlug || undefined,
        });
      }
    },
    [situationId, stateCode, county, citySlug, originCode, intent, situation.needsDestination]
  );

  // Preview plan as fields change — do not overwrite saved metadata
  useEffect(() => {
    buildPlan(false);
  }, [buildPlan]);

  const planKey = useMemo(() => {
    if (!plan) return '';
    return makePlanKey({
      situationId: plan.situationId,
      stateCode: plan.context.stateCode,
      county: plan.context.county,
    });
  }, [plan]);

  const visitedCount = plan
    ? plan.steps.filter((s) => visited.has(s.id)).length
    : 0;
  const total = plan?.steps.length ?? 0;

  const onCityPick = (slug: string) => {
    setCitySlug(slug);
    const hit = MOVE_CITY_HUBS.find((c) => c.citySlug === slug);
    if (hit) {
      setStateCode(hit.stateCode);
      if (hit.countySlug) setCounty(hit.countySlug);
    }
  };

  const onStepClick = (stepId: string, hub: JourneyHub) => {
    if (!planKey) return;
    const next = markStepVisited(planKey, stepId);
    if (next) setVisited(new Set(next.visitedStepIds));
    recordHubVisit(stepId, hub);
  };

  return (
    <section
      id="whats-happening"
      data-hub="ask"
      data-stage="b2-orchestration"
      aria-labelledby="whats-happening-heading"
      className={cn(
        'section-block scroll-mt-24 border-b',
        className
      )}
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
    >
      <div className="container-page">
        <div className="mx-auto max-w-3xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Trust Journey planner
          </p>
          <h2
            id="whats-happening-heading"
            className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{ color: ASK_BRAND.navy }}
          >
            What&apos;s happening?
          </h2>
          <p className="mt-2 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Tell us the situation. Ask builds an ordered research path into the specialist hubs that apply —
            Insurance Trust Hub — with context preserved. No account. No personal data.
          </p>
        </div>

        <div
          className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white p-5 sm:p-8"
          style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.card }}
        >
          {/* Situation chips */}
          <fieldset>
            <legend
              className="text-sm font-semibold"
              style={{ color: ASK_BRAND.navy }}
            >
              Situation
            </legend>
            <ul className="mt-3 flex flex-wrap gap-2" role="list">
              {SITUATION_OPTIONS.map((opt) => {
                const active = situationId === opt.id;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSituationId(opt.id);
                        if (opt.fixedIntent) setIntent(opt.fixedIntent);
                      }}
                      aria-pressed={active}
                      className={cn(
                        'inline-flex min-h-10 items-center rounded-full border px-3.5 py-1.5 text-left text-xs font-semibold transition-colors sm:text-sm',
                        active
                          ? 'border-transparent text-white'
                          : 'bg-white hover:border-[#4F46E5]/40'
                      )}
                      style={
                        active
                          ? { backgroundColor: ASK_BRAND.indigo, borderColor: ASK_BRAND.indigo }
                          : { borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }
                      }
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
              {situation.description}
            </p>
          </fieldset>

          {/* Geography — non-PII only */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                Destination state
                {situation.needsDestination ? '' : ' (optional)'}
              </span>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium"
                style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              >
                <option value="">Select state…</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                County or market{' '}
                <span className="font-normal opacity-70">(optional)</span>
              </span>
              <input
                type="text"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                placeholder="e.g. miami-dade"
                autoComplete="off"
                className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium"
                style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                Origin state{' '}
                <span className="font-normal opacity-70">(optional)</span>
              </span>
              <select
                value={originCode}
                onChange={(e) => setOriginCode(e.target.value)}
                className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium"
                style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              >
                <option value="">Not specified</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                Popular destination city{' '}
                <span className="font-normal opacity-70">(optional)</span>
              </span>
              <select
                value={citySlug}
                onChange={(e) => onCityPick(e.target.value)}
                className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium"
                style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              >
                <option value="">None</option>
                {MOVE_CITY_HUBS.map((c) => (
                  <option key={c.citySlug} value={c.citySlug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {situationId === 'coverage_after_move' || situationId === 'unknown' ? (
            <div className="mt-4">
              <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                Housing intent (optional)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { id: 'unknown' as const, label: 'Not sure' },
                    { id: 'buy' as const, label: 'May buy' },
                    { id: 'rent' as const, label: 'Renting' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIntent(opt.id)}
                    aria-pressed={intent === opt.id}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold',
                      intent === opt.id ? 'border-transparent text-white' : 'bg-white'
                    )}
                    style={
                      intent === opt.id
                        ? { backgroundColor: ASK_BRAND.indigo }
                        : { borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => buildPlan(true)}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white sm:w-auto"
            style={{
              backgroundColor: ASK_BRAND.indigo,
              boxShadow: ASK_SHADOW.indigo,
            }}
          >
            <Route className="h-4 w-4" aria-hidden />
            Save &amp; build my research path
          </button>

          <p className="mt-3 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Save stores high-level situation metadata in this browser for My Trust Journey.
            Directories and tools live on the specialist hubs — not here. No account required.
          </p>
        </div>

        {/* Plan output */}
        {plan ? (
          <div className="mx-auto mt-8 max-w-3xl" aria-live="polite">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  Your Trust Journey plan
                </p>
                <h3
                  className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl"
                  style={{ color: ASK_BRAND.navy }}
                >
                  {plan.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {plan.summary}
                </p>
                {plan.place ? (
                  <p
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: ASK_BRAND.navy }}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {plan.place}
                  </p>
                ) : null}
              </div>
              {total > 0 ? (
                <p
                  className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                >
                  {visitedCount === 0
                    ? `${total} step${total === 1 ? '' : 's'}`
                    : `Step progress · ${visitedCount} of ${total} visited`}
                </p>
              ) : null}
            </div>

            {plan.clarifyingNote ? (
              <p
                className="mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  borderColor: ASK_BRAND.border,
                  backgroundColor: ASK_BRAND.periwinkle,
                  color: ASK_BRAND.navy,
                }}
              >
                {plan.clarifyingNote}
              </p>
            ) : null}

            <ol className="mt-6 space-y-4">
              {plan.steps.map((s) => {
                const done = visited.has(s.id);
                return (
                  <li
                    key={s.id}
                    className="rounded-2xl border bg-white p-5 sm:p-6"
                    style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-bold uppercase tracking-[0.12em]"
                          style={{ color: HUB_ACCENT[s.hub] ?? ASK_BRAND.indigo }}
                        >
                          Step {s.step} of {total}
                          {done ? ' · Visited' : ''} · {s.hubLabel}
                        </p>
                        <h4
                          className="mt-1 text-lg font-semibold tracking-tight"
                          style={{ color: ASK_BRAND.navy }}
                        >
                          {s.title}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                          {s.why}
                        </p>
                      </div>
                      {done ? (
                        <CheckCircle2
                          className="h-6 w-6 shrink-0"
                          style={{ color: '#16A34A' }}
                          aria-label="Visited"
                        />
                      ) : null}
                    </div>
                    <a
                      href={s.href}
                      rel="noopener noreferrer"
                      onClick={() => onStepClick(s.id, s.hub)}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white"
                      style={{ backgroundColor: ASK_BRAND.indigo }}
                      data-journey-hub={s.hub}
                      data-journey-step={s.step}
                      data-src="ask"
                    >
                      {s.cta}
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </a>
                    <p className="mt-2 break-all text-[11px] leading-relaxed opacity-70" style={{ color: ASK_BRAND.ink }}>
                      {s.href}
                    </p>
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 text-center text-sm">
              <a
                href="/my-trust-journey"
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: ASK_BRAND.indigo }}
              >
                Open My Trust Journey overview
              </a>
              <span className="mx-2 opacity-50">·</span>
              <span style={{ color: ASK_BRAND.ink }}>
                Optional browser metadata — no account
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
