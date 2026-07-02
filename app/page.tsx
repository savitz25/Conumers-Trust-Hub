'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Shield, Route } from 'lucide-react';
import { ZipSearchBar } from '@/components/zip-search-bar';
import { HubSwitcher } from '@/components/hub-switcher';
import { TrustBadge, TrustProofRow } from '@/components/trust-badge';
import { ProgressRing } from '@/components/progress-ring';
import { HUB_SITES } from '@/lib/sites';
import { BRAND } from '@/lib/brand';
import { VERIFICATION_SOURCES } from '@/lib/stats';
import { fadeUp, staggerContainer } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';

/**
 * Homepage — logged-out hero entry.
 * Delightful coach tone, journey metaphor, hub discovery cards.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      {/* Hero */}
      <section className="relative overflow-hidden fun-gradient-bg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-trust/10 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 py-16 md:py-28 relative">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div variants={fadeUp} custom={0}>
              <TrustBadge type="independent" className="mb-6" />
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="section-heading">
              {BRAND.coachTagline}
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="coach-copy mx-auto mt-5 max-w-2xl">
              Moving, insurance, and lending — finally in one friendly place. We verify every
              provider so you can focus on the exciting part: your new chapter.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-10 mx-auto max-w-xl">
              <ZipSearchBar variant="hero" />
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="trust" asChild className="rounded-xl gap-2">
                <Link href="/onboarding">
                  Start your journey <Sparkles className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-xl">
                <Link href="/dashboard">See your dashboard</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Journey teaser */}
      <section className="border-y bg-card py-14">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-10">
          <ProgressRing progress={8} label="Your move" sublabel="8% — let's build momentum!" />
          <div className="max-w-md text-center md:text-left">
            <h2 className="text-2xl font-bold flex items-center gap-2 justify-center md:justify-start">
              <Route className="h-6 w-6 text-trust" />
              Your relocation journey
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every checklist item you complete unlocks progress. No boring spreadsheets — just
              small wins that add up to a stress-free move.
            </p>
            <Link href="/checklist" className="mt-4 inline-flex items-center gap-1 font-semibold text-trust hover:underline">
              Open your checklist <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Hub cards */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <HubSwitcher className="mb-6" />
            <h2 className="text-3xl font-bold">Three hubs. One happy ending.</h2>
            <p className="mt-3 text-muted-foreground">Pick a lane — or explore them all. We&apos;ll remember your ZIP.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {Object.values(HUB_SITES).map((hub, i) => (
              <motion.div
                key={hub.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={hub.path}>
                  <Card
                    className="hub-card h-full"
                    style={{ borderTopColor: hub.accent, borderTopWidth: 3 }}
                  >
                    <CardContent className="pt-6">
                      <span className="text-3xl" role="img" aria-hidden>{hub.emoji}</span>
                      <p className="text-xs font-semibold text-muted-foreground mt-3">{hub.poweredBy}</p>
                      <h3 className="text-xl font-bold mt-1" style={{ color: hub.accent }}>
                        {hub.subBrand}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">{hub.coachLine}</p>
                      <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-trust">
                        Explore <ArrowRight className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust proof */}
      <section className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <Shield className="h-8 w-8 text-trust mx-auto mb-4" aria-hidden />
          <h2 className="text-xl font-bold mb-6">Verified across every vertical</h2>
          <TrustProofRow items={[...VERIFICATION_SOURCES.slice(0, 5)]} />
        </div>
      </section>
    </>
  );
}