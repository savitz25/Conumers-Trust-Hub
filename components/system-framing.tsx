import { TrustMark } from '@/components/trust-mark';

/**
 * Short product framing: one research system for life events — not an org chart.
 * Sits with the situation router so the system is explicit after the first glance.
 */
export function SystemFraming() {
  return (
    <div className="mt-8 max-w-2xl rounded-xl border border-border/70 bg-muted/30 px-5 py-4 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        One research system
      </p>
      <p className="mt-1.5 text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
        Big decisions, one research system
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Specialist hubs for moving, home financing, and insurance — independent research, no paid
        placements. Pick a situation above, or follow a full life journey below.
      </p>
      <div className="mt-3">
        <TrustMark />
      </div>
    </div>
  );
}
