import { TrustMark } from '@/components/trust-mark';

/**
 * Short product framing: one research system for life events — not an org chart.
 * Sits with the situation grid under the hero Concierge.
 */
export function SystemFraming() {
  return (
    <div className="mt-6 max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
        One research system
      </p>
      <p className="mt-1.5 text-sm font-semibold tracking-tight text-[#0A2540] sm:text-[15px]">
        Big decisions, one research system
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[#1E293B]">
        Specialist hubs for moving, home financing, and insurance under one network: common
        ownership, separated research and listing order, no paid placements. Pick a situation, or
        follow a full life journey below.
      </p>
      <div className="mt-3">
        <TrustMark />
      </div>
    </div>
  );
}
