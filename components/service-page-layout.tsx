'use client';

import Link from 'next/link';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UnifiedSearch } from '@/components/unified-search';
import { type SisterSite } from '@/lib/sites';

interface ServicePageLayoutProps {
  site: SisterSite;
  hubTools: { title: string; description: string; href: string; external?: boolean }[];
}

export function ServicePageLayout({ site, hubTools }: ServicePageLayoutProps) {
  return (
    <>
      <section className="border-b bg-gradient-to-br from-primary/5 via-background to-trust/5 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-trust">
              {site.verificationBadge} · Zero Paid Placements
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">{site.name}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{site.tagline}</p>

            <div className="mt-8 max-w-md">
              <UnifiedSearch defaultVertical={site.id} />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="trust" asChild className="gap-2">
                <a href={site.url} target="_blank" rel="noopener noreferrer">
                  Go to {site.name} <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              {site.calculatorPath && (
                <Button variant="outline" asChild>
                  <a href={`${site.url}${site.calculatorPath}`} target="_blank" rel="noopener noreferrer">
                    Use Calculators
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="overview">
            <TabsList className="mb-8">
              <TabsTrigger value="overview">Hub Overview</TabsTrigger>
              <TabsTrigger value="tools">Hub Tools</TabsTrigger>
              <TabsTrigger value="live">Live Site</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {site.stats.map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="pt-6 text-center">
                      <p className="text-2xl font-bold text-trust">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {site.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 rounded-lg border p-4 text-sm">
                    <span className="h-2 w-2 rounded-full bg-trust" />
                    {feature}
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="tools" className="space-y-4">
              <p className="text-muted-foreground">
                Hub-exclusive shortcuts and comparison tools. Full functionality lives on the live site.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {hubTools.map((tool) => (
                  <Card key={tool.title} className="hover:shadow-trust-lg transition-shadow">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold">{tool.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                      <Button variant="link" className="mt-3 h-auto p-0 gap-1" asChild>
                        {tool.external ? (
                          <a href={tool.href} target="_blank" rel="noopener noreferrer">
                            Open tool <ArrowRight className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <Link href={tool.href}>
                            Open tool <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="live">
              <Card>
                <CardContent className="pt-6">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Browse the full {site.name} experience — directories, calculators, guides, and quote tools.
                  </p>
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-lg border bg-muted">
                    <iframe
                      src={site.url}
                      title={`${site.name} preview`}
                      className="h-full w-full"
                      loading="lazy"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    If the preview does not load,{' '}
                    <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-trust underline">
                      open {site.domain} directly
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </>
  );
}