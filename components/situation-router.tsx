import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SystemFraming } from '@/components/system-framing';
import {
  SITUATION_PROMPT,
  SITUATION_SUBCOPY,
  SITUATIONS,
  type SituationRoute,
} from '@/lib/situations';
import { cn } from '@/lib/utils';

const HUB_TAG_STYLES: Record<SituationRoute['hubTag'], string> = {
  move: 'bg-[#FFF4EF] text-[#C2410C] border-[#FFD4C2]',
  insurance: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]',
  lender: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
  network: 'bg-[#E0E7FF] text-[#3730A3] border-[#C7D2FE]',
  multi: 'bg-[#E0E7FF] text-[#4F46E5] border-[#C7D2FE]',
};

const cardShell = cn(
  'flex h-full min-h-[8rem] flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6',
  'shadow-[0_1px_2px_rgb(10_37_64_/_0.04),0_4px_16px_rgb(10_37_64_/_0.04)]',
  'transition-colors hover:border-[#4F46E5]/30 hover:bg-[#F8FAFC]'
);

/**
 * Situation grid — secondary to hero Concierge.
 * H2 only (hero owns the page H1). Anchor: #ask
 */
export function SituationRouter() {
  return (
    <section
      id="ask"
      aria-labelledby="situation-router-heading"
      className="section-block scroll-mt-24 border-b border-[#E2E8F0] bg-[#F8FAFC]"
    >
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
            Guided situations
          </p>
          <h2
            id="situation-router-heading"
            className="mt-3 text-2xl font-semibold tracking-tight text-[#0A2540] sm:text-3xl"
          >
            {SITUATION_PROMPT}
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[#1E293B] sm:text-lg">
            {SITUATION_SUBCOPY}
          </p>
          <SystemFraming />
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {SITUATIONS.map((s) => (
            <li key={s.id} id={`situation-${s.id}`} className={cardShell}>
              <span
                className={cn(
                  'inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
                  HUB_TAG_STYLES[s.hubTag]
                )}
              >
                {s.hubLabel}
              </span>
              <h3 className="mt-3 text-base font-semibold tracking-tight text-[#0A2540] sm:text-[17px]">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1E293B]">{s.detail}</p>

              {s.checklist && s.checklist.length > 0 ? (
                <>
                  <ol className="mt-4 space-y-2.5 border-t border-[#E2E8F0] pt-4">
                    {s.checklist.map((step) => (
                      <li key={step.step}>
                        <a
                          href={step.href}
                          className="group flex gap-3 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-[11px] font-bold text-white">
                            {step.step}
                          </span>
                          <span className="min-w-0">
                            <span className="font-medium text-[#0A2540] group-hover:text-[#4F46E5] group-hover:underline">
                              {step.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-[#1E293B]">
                              {step.hubLabel}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ol>
                  {s.checklist[0] ? (
                    <a href={s.checklist[0].href} className="btn-primary mt-5 w-full sm:w-auto">
                      {s.cta}
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </a>
                  ) : null}
                </>
              ) : s.href ? (
                <a href={s.href} className="btn-primary mt-5 w-full sm:w-auto">
                  {s.cta}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm leading-relaxed text-[#1E293B]">
          Directories and tools live on the specialist hubs — not on this site. Ask routes you; the
          hubs do the deep research. No forms and no personal data collected for routing.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link
            href="/#life-journeys"
            className="font-semibold text-[#4F46E5] underline-offset-4 hover:text-[#6B21A8] hover:underline"
          >
            Life journeys
          </Link>
          <Link
            href="/network"
            className="font-semibold text-[#4F46E5] underline-offset-4 hover:text-[#6B21A8] hover:underline"
          >
            Explore the network
          </Link>
        </p>
      </div>
    </section>
  );
}
