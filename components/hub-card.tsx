import { ArrowUpRight } from 'lucide-react';
import type { TrustHub } from '@/lib/hubs';

export function HubCard({ hub }: { hub: TrustHub }) {
  const isLive = hub.status === 'live';

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {hub.shortName}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {hub.name}
          </h3>
        </div>
        <span
          className={
            isLive
              ? 'text-[11px] font-semibold uppercase tracking-wide text-trust'
              : 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'
          }
        >
          {isLive ? 'Live' : 'Planned'}
        </span>
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
        {hub.description}
      </p>

      <div className="mt-5 border-t border-border/80 pt-4">
        <p className="text-xs font-medium text-foreground/80">{hub.verification}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hub.dataSources.join(' · ')}</p>
      </div>

      {isLive ? (
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-navy">
          {hub.domain}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : (
        <span className="mt-5 text-xs text-muted-foreground">{hub.domain}</span>
      )}
    </>
  );

  const className =
    'flex h-full flex-col border border-border/80 bg-background p-6 transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust';

  if (isLive) {
    return (
      <a href={hub.url} className={className} rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}
