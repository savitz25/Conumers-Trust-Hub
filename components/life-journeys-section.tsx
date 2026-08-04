import { ArrowUpRight } from 'lucide-react';
import { LIFE_JOURNEYS } from '@/lib/life-journeys';

/**
 * Elevated “Life journeys” product surface — ordered multi-hub paths.
 * Situation cards stay primary for immediate questions; this makes the system explicit.
 */
export function LifeJourneysSection() {
  return (
    <section
      id="life-journeys"
      aria-labelledby="life-journeys-heading"
      className="scroll-mt-20 border-b border-border/80 bg-muted/25"
    >
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="section-label">Life journeys</p>
          <h2
            id="life-journeys-heading"
            className="section-title mt-3"
          >
            Big decisions, one research system
          </h2>
          <p className="section-lead mt-3">
            Specialist hubs for moving, home financing, and insurance — independent research, no
            paid placements. Ask routes you; each hub executes the deep work under The Ask Trust Hub
            Standard.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground sm:text-[15px]">
            <li>
              <span className="font-semibold text-foreground">Moving</span>
              {' → '}
              <span className="italic">Where are you going?</span>
              {' '}
              <span className="text-muted-foreground/80">(Move Trust Hub)</span>
            </li>
            <li>
              <span className="font-semibold text-foreground">Buying</span>
              {' → '}
              <span className="italic">What are you trying to accomplish?</span>
              {' '}
              <span className="text-muted-foreground/80">(Lender Trust Hub)</span>
            </li>
            <li>
              <span className="font-semibold text-foreground">Protecting</span>
              {' → '}
              <span className="italic">What are you trying to protect?</span>
              {' '}
              <span className="text-muted-foreground/80">(Insurance Trust Hub)</span>
            </li>
          </ul>
        </div>

        <ul className="mt-10 grid gap-5 lg:grid-cols-3">
          {LIFE_JOURNEYS.map((journey) => (
            <li
              key={journey.id}
              className="flex h-full flex-col rounded-xl border border-border/80 bg-background p-6 shadow-soft"
            >
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {journey.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {journey.summary}
              </p>

              <ol className="mt-5 flex-1 space-y-4 border-t border-border/70 pt-5">
                {journey.steps.map((step) => (
                  <li key={step.step} className="flex gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white"
                      aria-hidden
                    >
                      {step.step}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{step.hubLabel}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {step.why}
                      </p>
                      <a
                        href={step.href}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-navy underline-offset-2 hover:underline"
                        rel="noopener noreferrer"
                      >
                        {step.cta}
                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-muted-foreground">
          No directories on this site. Each step opens the specialist hub that owns that research.
        </p>
      </div>
    </section>
  );
}
