import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HUB_SITES, type ServiceVertical } from '@/lib/sites';
import { Button } from '@/components/ui/button';

interface CrossPromoBannerProps {
  current?: ServiceVertical | 'hub';
}

export function CrossPromoBanner({ current = 'hub' }: CrossPromoBannerProps) {
  const others = Object.values(HUB_SITES).filter((s) => s.id !== current);

  return (
    <aside className="border-y bg-muted/30 py-3" aria-label="Explore hubs">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-2 px-4">
        <p className="text-sm text-muted-foreground">Explore:</p>
        {others.map((site) => (
          <Button key={site.id} variant="outline" size="sm" asChild className="rounded-xl">
            <Link href={site.path} className="gap-1">
              {site.emoji} {site.shortName} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ))}
      </div>
    </aside>
  );
}