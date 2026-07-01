'use client';

import Link from 'next/link';
import { ArrowRight, ExternalLink, Truck, Landmark, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnifiedSearch } from '@/components/unified-search';
import { type SisterSite, type ServiceVertical } from '@/lib/sites';

const ICONS: Record<ServiceVertical, React.ElementType> = {
  moving: Truck,
  lending: Landmark,
  insurance: Shield,
};

interface ServiceCardProps {
  site: SisterSite;
  showMiniSearch?: boolean;
  index?: number;
}

export function ServiceCard({ site, showMiniSearch = true, index = 0 }: ServiceCardProps) {
  const Icon = ICONS[site.id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="flex h-full flex-col transition-shadow hover:shadow-trust-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-trust/10 text-trust">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-lg">{site.name}</CardTitle>
                <Badge variant="success" className="mt-1">{site.verificationBadge}</Badge>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{site.tagline}</p>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {site.stats.map((stat) => (
              <div key={stat.label} className="rounded-lg bg-muted/50 px-2 py-2 text-center">
                <p className="text-sm font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>

          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {site.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-trust shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {showMiniSearch && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Quick search on {site.shortName}</p>
              <UnifiedSearch defaultVertical={site.id} compact />
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="trust" className="w-full gap-2" asChild>
            <Link href={`/${site.id}`}>
              {site.ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" className="w-full gap-2" asChild>
            <a href={site.url} target="_blank" rel="noopener noreferrer">
              Visit Site <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}