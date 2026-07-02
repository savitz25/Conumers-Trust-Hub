'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Calculator, Search, BookOpen } from 'lucide-react';
import { HubBrandHeader } from '@/components/hub-switcher';
import { ZipSearchBar } from '@/components/zip-search-bar';
import { TrustBadge, TrustProofRow } from '@/components/trust-badge';
import { ProgressRing } from '@/components/progress-ring';
import { HubSwitcher } from '@/components/hub-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { HubSite } from '@/lib/sites';
import { fadeUp, staggerContainer } from '@/lib/animations';

interface HubLandingProps {
  site: HubSite;
  tools: { title: string; description: string; href: string; icon?: 'calculator' | 'search' | 'book' }[];
  journeyProgress?: number;
  coachMessage?: string;
}

const TOOL_ICONS = {
  calculator: Calculator,
  search: Search,
  book: BookOpen,
};

/**
 * Shared hub landing shell — accent gradient, journey ring, tool grid.
 */
export function HubLanding({ site, tools, journeyProgress = 12, coachMessage }: HubLandingProps) {
  const accent = site.accent;

  return (
    <>
      {/* Hero with vertical accent wash */}
      <section
        className="relative overflow-hidden border-b"
        style={{
          background: `linear-gradient(135deg, ${accent}12 0%, transparent 50%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted)/0.3) 100%)`,
        }}
      >
        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <HubBrandHeader hub={{
              subBrand: site.subBrand,
              poweredBy: site.poweredBy,
              accent: site.accent,
              emoji: site.emoji,
            }} />
            <HubSwitcher size="sm" />
          </div>

          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">
              <motion.div variants={fadeUp} custom={0}>
                <TrustBadge
                  type={site.id === 'moving' ? 'FMCSA' : site.id === 'lending' ? 'NMLS' : 'DOI'}
                />
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="section-heading mt-4">
                {site.coachLine}
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="coach-copy mt-4 max-w-xl">
                {site.tagline} Zero paid placements — ever. Let&apos;s find your perfect match.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="mt-8 max-w-md">
                <ZipSearchBar
                  defaultVertical={site.id}
                  showHubSwitcher={false}
                  variant="hero"
                  coachHint={`Search ${site.shortName.toLowerCase()} near your new ZIP`}
                />
              </motion.div>

              <motion.div variants={fadeUp} custom={4} className="mt-6 flex flex-wrap gap-3">
                <Button variant="trust" size="lg" asChild className="rounded-xl gap-2">
                  <Link href={site.directoryPath}>
                    {site.ctaLabel} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="rounded-xl">
                  <Link href={site.calculatorPath}>Try Calculators</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Journey progress — gamified hub entry */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-8 text-center hidden md:block"
            >
              <ProgressRing
                progress={journeyProgress}
                label="Journey"
                sublabel={coachMessage ?? "You're just getting started — and that's exciting!"}
              />
              <Link href="/checklist" className="mt-4 inline-block text-sm font-semibold text-trust hover:underline">
                Open master checklist →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="border-b bg-muted/30 py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {site.stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="stat-card"
              >
                <p className="text-2xl md:text-3xl font-bold" style={{ color: accent }}>
                  {stat.value}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-2">Your {site.shortName} toolkit</h2>
          <p className="text-muted-foreground mb-8">Everything you need — no tab-hopping required.</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map((tool, i) => {
              const Icon = TOOL_ICONS[tool.icon ?? 'search'];
              return (
                <motion.div
                  key={tool.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link href={tool.href}>
                    <Card className="h-full hub-card group">
                      <CardContent className="pt-6">
                        <div
                          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${accent}18`, color: accent }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold group-hover:text-trust transition-colors">{tool.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features + trust */}
      <section className="border-t py-12 bg-card">
        <div className="container mx-auto px-4">
          <ul className="grid gap-3 sm:grid-cols-2 max-w-3xl mx-auto mb-10">
            {site.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-trust shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <TrustProofRow items={['Zero Paid Placements', site.verificationBadge, 'Attributed Reviews']} />
        </div>
      </section>
    </>
  );
}