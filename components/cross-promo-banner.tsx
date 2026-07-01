import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { SISTER_SITES, type ServiceVertical } from '@/lib/sites';
import { Button } from '@/components/ui/button';

interface CrossPromoBannerProps {
  current?: ServiceVertical | 'hub';
  className?: string;
}

export function CrossPromoBanner({ current = 'hub' }: CrossPromoBannerProps) {
  const others = Object.values(SISTER_SITES).filter((s) => s.id !== current);

  return (
    <aside
      className="border-y bg-gradient-to-r from-primary/5 via-trust/5 to-primary/5 py-4"
      aria-label="Explore sister Trust Hub sites"
    >
      <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 sm:flex-row">
        <p className="text-center text-sm font-medium text-muted-foreground sm:text-left">
          {current === 'hub'
            ? 'Explore our specialized directories for deeper research:'
            : 'Also explore our other verified directories:'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {current !== 'hub' && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/" className="gap-1">
                Consumers Trust Hub <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          {others.map((site) => (
            <Button key={site.id} variant="outline" size="sm" asChild>
              <a href={site.url} target="_blank" rel="noopener noreferrer" className="gap-1">
                {site.shortName} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}