import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import {
  SITUATION_PROMPT,
  SITUATION_SUBCOPY,
  SITUATIONS,
  type SituationRoute,
} from '@/lib/situations';
import { cn } from '@/lib/utils';

const HUB_TAG_STYLES: Record<SituationRoute['hubTag'], string> = {
  move: 'bg-blue-50 text-blue-800 border-blue-100',
  insurance: 'bg-teal-50 text-teal-800 border-teal-100',
  lender: 'bg-indigo-50 text-indigo-800 border-indigo-100',
  network: 'bg-slate-100 text-slate-700 border-slate-200',
};

function isExternal(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

const cardClassName = cn(
  'group flex h-full min-h-[7.5rem] flex-col rounded-xl border border-border/80 bg-background p-5 sm:p-6',
  'transition-colors hover:border-navy/25 hover:bg-muted/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2'
);

function SituationCardBody({ s }: { s: SituationRoute }) {
  return (
    <>
      <span
        className={cn(
          'inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
          HUB_TAG_STYLES[s.hubTag]
        )}
      >
        {s.hubLabel}
      </span>
      <span className="mt-3 text-base font-semibold tracking-tight text-foreground sm:text-[17px]">
        {s.title}
      </span>
      <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.detail}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy group-hover:underline">
        {s.cta}
        <ArrowUpRight
          className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </span>
    </>
  );
}

/**
 * Homepage situation router — discovery only.
 * Routes to specialist hubs/tools or Ask Trust Center pages.
 */
export function SituationRouter() {
  return (
    <section
      aria-labelledby="situation-router-heading"
      className="border-b border-border/80 bg-background"
    >
      <div className="container-page py-12 sm:py-16 lg:py-20">
        <div className="max-w-2xl">
          <p className="section-label">Ask Trust Hub</p>
          <h1
            id="situation-router-heading"
            className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]"
          >
            {SITUATION_PROMPT}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {SITUATION_SUBCOPY}
          </p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {SITUATIONS.map((s) => (
            <li key={s.id}>
              {isExternal(s.href) ? (
                <a
                  href={s.href}
                  className={cardClassName}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <SituationCardBody s={s} />
                </a>
              ) : (
                <Link href={s.href} className={cardClassName}>
                  <SituationCardBody s={s} />
                </Link>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-muted-foreground">
          Directories, calculators, and market tools live on the specialist hubs — not on this site.
          Ask routes you; the hubs do the deep research.
        </p>
      </div>
    </section>
  );
}

