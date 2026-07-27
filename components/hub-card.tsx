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
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {hub.name}
          </h3>
        </div>
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-trust/10 px-2.5 py-1 text-[11px] font-semibold text-trust">
            Live
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Coming soon
          </span>
        )}
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
        {hub.description}
      </p>

      <div className="mt-5 border-t border-border/70 pt-4">
        <p className="text-xs font-medium text-foreground/80">{hub.verification}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hub.dataSources.join(' · ')}</p>
      </div>

      {isLive && (
        <span className="btn-ghost mt-5 self-start">
          Visit site <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      )}
    </>
  );

  const className =
    'card-surface flex h-full flex-col p-6 transition-shadow hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust';

  if (isLive) {
    return (
      <a href={hub.url} className={className} rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return <div className={`${className} opacity-95`}>{inner}</div>;
}
