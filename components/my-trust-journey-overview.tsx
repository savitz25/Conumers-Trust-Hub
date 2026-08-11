'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  MapPin,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import {
  clearJourneyMetadata,
  contextFromMetadata,
  currentStepLabel,
  loadJourneyMetadata,
  progressForMetadata,
  rebuildPlanFromMetadata,
  recordHubVisit,
  researchContinueLinks,
  situationSummaryLine,
  specialistContinues,
  stepStatus,
  type JourneyMetadata,
} from '@/lib/orchestration/journey-metadata';
import { placeLabel } from '@/lib/orchestration/journey-links';
import {
  SITUATION_OPTIONS,
  type TrustJourneyPlan,
} from '@/lib/orchestration/path-generator';
import { visitedSetForPlan } from '@/lib/orchestration/progress';
import { cn } from '@/lib/utils';

const HUB_ACCENT: Record<string, string> = {
  move: '#C2410C',
  lender: '#166534',
  insurance: '#0F766E',
};

/**
 * Stage B.3 — calm journey overview (metadata only, optional, no login).
 */
export function MyTrustJourneyOverview() {
  const [meta, setMeta] = useState<JourneyMetadata | null>(null);
  const [plan, setPlan] = useState<TrustJourneyPlan | null>(null);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    const m = loadJourneyMetadata();
    setMeta(m);
    if (m) {
      const p = rebuildPlanFromMetadata(m);
      setPlan(p);
      setVisited(visitedSetForPlan(m.planKey));
    } else {
      setPlan(null);
      setVisited(new Set());
    }
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const situationLabel = useMemo(() => {
    if (!meta) return null;
    return SITUATION_OPTIONS.find((s) => s.id === meta.situationId)?.label ?? meta.situationId;
  }, [meta]);

  const progressLine = useMemo(() => {
    if (!meta || !plan) return null;
    return currentStepLabel(plan, meta, progressForMetadata(meta));
  }, [meta, plan]);

  const myLinks = useMemo(
    () => (meta ? specialistContinues(meta) : []),
    [meta]
  );
  const researchLinks = useMemo(
    () => (meta ? researchContinueLinks(meta) : []),
    [meta]
  );

  const onStepContinue = (stepId: string, hub: 'move' | 'lender' | 'insurance') => {
    recordHubVisit(stepId, hub);
    refresh();
  };

  const onClear = () => {
    clearJourneyMetadata();
    refresh();
  };

  if (!ready) {
    return (
      <div className="container-page py-16 text-sm" style={{ color: ASK_BRAND.ink }}>
        Loading your research journey…
      </div>
    );
  }

  if (!meta || !plan) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div
          className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center"
          style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Optional · browser only
          </p>
          <h2
            className="mt-3 text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            No journey saved yet
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Build a research path from What&apos;s happening? — we store only high-level
            situation metadata in this browser. Specialist shortlists stay on Move, Lender,
            and Insurance.
          </p>
          <Link
            href="/#whats-happening"
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white"
            style={{ backgroundColor: ASK_BRAND.indigo, boxShadow: ASK_SHADOW.indigo }}
          >
            What&apos;s happening?
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  const place = placeLabel(contextFromMetadata(meta));
  const total = plan.steps.length;
  const visitedCount = plan.steps.filter((s) => visited.has(s.id)).length;

  return (
    <div className="container-page py-10 sm:py-14">
      {/* Summary */}
      <div
        className="rounded-2xl border bg-white p-6 sm:p-8"
        style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.card }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: ASK_BRAND.indigo }}
        >
          Your research journey
        </p>
        <h2
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: ASK_BRAND.navy }}
        >
          {situationLabel}
        </h2>
        <p
          className="mt-2 inline-flex flex-wrap items-center gap-2 text-base font-medium"
          style={{ color: ASK_BRAND.navy }}
        >
          {place ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden />
              {situationSummaryLine(meta)}
            </span>
          ) : (
            situationSummaryLine(meta)
          )}
        </p>
        {progressLine ? (
          <p className="mt-3 text-sm font-semibold" style={{ color: ASK_BRAND.indigo }}>
            {progressLine}
            {total > 0 ? (
              <span className="ml-2 font-normal opacity-80">
                ({visitedCount} of {total} steps opened from Ask)
              </span>
            ) : null}
          </p>
        ) : null}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          {plan.summary} Metadata only on Ask — not a merged account across hubs.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/#whats-happening"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold"
            style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.indigo }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Update situation
          </Link>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold"
            style={{ color: ASK_BRAND.ink }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Clear this overview
          </button>
        </div>
      </div>

      {/* Steps */}
      <section className="mt-10" aria-labelledby="journey-steps-heading">
        <h3
          id="journey-steps-heading"
          className="text-lg font-semibold tracking-tight"
          style={{ color: ASK_BRAND.navy }}
        >
          Ordered research steps
        </h3>
        <ol className="mt-4 space-y-4">
          {plan.steps.map((s) => {
            const status = stepStatus(s.id, plan, meta, visited);
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
                      Step {s.step} of {total} · {s.hubLabel}
                      {status === 'visited'
                        ? ' · Visited'
                        : status === 'current'
                          ? ' · Current'
                          : ' · Not started'}
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
                  {status === 'visited' ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
                  ) : status === 'current' ? (
                    <Circle
                      className="h-6 w-6 shrink-0"
                      style={{ color: ASK_BRAND.indigo }}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <a
                  href={s.href}
                  rel="noopener noreferrer"
                  onClick={() => onStepContinue(s.id, s.hub)}
                  className={cn(
                    'mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white'
                  )}
                  style={{ backgroundColor: ASK_BRAND.indigo }}
                  data-journey-hub={s.hub}
                  data-journey-step={s.step}
                >
                  {status === 'visited' ? 'Continue again' : s.cta}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Specialist My… workspaces */}
      <section className="mt-12" aria-labelledby="my-workspaces-heading">
        <h3
          id="my-workspaces-heading"
          className="text-lg font-semibold tracking-tight"
          style={{ color: ASK_BRAND.navy }}
        >
          Specialist workspaces
        </h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Saved details live on each hub. Ask does not merge My Move, My Lending, or My Insurance
          into one account.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {myLinks.map((item) => (
            <li key={item.hub}>
              <a
                href={item.href}
                rel="noopener noreferrer"
                className="flex h-full flex-col rounded-2xl border bg-white p-5 transition-colors hover:border-[#4F46E5]/35"
                style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
              >
                <span
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: HUB_ACCENT[item.hub] }}
                >
                  Open {item.label}
                </span>
                <span
                  className="mt-2 text-sm font-semibold"
                  style={{ color: ASK_BRAND.navy }}
                >
                  {item.label}
                </span>
                <span className="mt-1 flex-1 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {item.blurb}
                </span>
                <span
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  Continue
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Research continues */}
      {researchLinks.length > 0 ? (
        <section className="mt-10" aria-labelledby="research-continues-heading">
          <h3
            id="research-continues-heading"
            className="text-lg font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Continue public research
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {researchLinks.map((l) => (
              <li key={l.href + l.label}>
                <a
                  href={l.href}
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border bg-white px-4 text-sm font-semibold"
                  style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                >
                  {l.label}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 max-w-2xl text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Stored in this browser only: situation, destination, intent, and which steps you opened
        from Ask. No name, email, or phone. Cross-hub context still travels via URL params when you
        continue research.
      </p>
    </div>
  );
}
