'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle, FolderLock, Sparkles } from 'lucide-react';
import { ProgressRing } from '@/components/progress-ring';
import { HubSwitcher } from '@/components/hub-switcher';
import { HUB_SITES } from '@/lib/sites';
import { MASTER_CHECKLIST } from '@/lib/checklist';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fadeUp, staggerContainer } from '@/lib/animations';

export default function DashboardPage() {
  const completedCount = 1;
  const progress = Math.round((completedCount / MASTER_CHECKLIST.length) * 100);
  const nextTasks = MASTER_CHECKLIST.filter((t) => t.id !== 'budget').slice(0, 3);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        <motion.div variants={fadeUp} custom={0} className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-semibold text-trust flex items-center gap-1">
              <Sparkles className="h-4 w-4" /> Good to see you!
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">Your move command center</h1>
            <p className="text-muted-foreground mt-2">Three tasks due this week — you&apos;ve got this.</p>
          </div>
          <HubSwitcher size="sm" />
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Concierge summary */}
          <motion.div variants={fadeUp} custom={1} className="lg:col-span-2">
            <Card className="glass-panel border-trust/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-trust" />
                  AI Concierge says hi 👋
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Based on your journey, I&apos;d tackle <strong>mortgage pre-approval</strong> next —
                  it unlocks better mover quotes and insurance binders. Want me to walk you through it?
                </p>
                <Button variant="trust" className="mt-4 rounded-xl" asChild>
                  <Link href="/concierge">Chat with your coach</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Hub status widgets */}
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {Object.values(HUB_SITES).map((hub) => (
                <Link key={hub.id} href={hub.path}>
                  <Card className="hub-card" style={{ borderTop: `3px solid ${hub.accent}` }}>
                    <CardContent className="pt-5">
                      <span className="text-2xl">{hub.emoji}</span>
                      <p className="font-semibold mt-2">{hub.shortName}</p>
                      <p className="text-xs text-muted-foreground mt-1">Explore tools →</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Progress sidebar */}
          <motion.div variants={fadeUp} custom={2}>
            <Card className="text-center p-6">
              <ProgressRing progress={progress} sublabel="Keep going — you're doing great!" />
              <Link href="/checklist" className="mt-4 block text-sm font-semibold text-trust hover:underline">
                View full checklist
              </Link>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderLock className="h-4 w-4" /> Document Vault
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">0 documents — upload your first lease or policy!</p>
                <Button variant="outline" size="sm" className="mt-3 rounded-xl w-full" asChild>
                  <Link href="/vault">Open Vault</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Up next */}
        <motion.section variants={fadeUp} custom={3} className="mt-10">
          <h2 className="text-xl font-bold mb-4">Up next on your journey</h2>
          <ul className="space-y-3">
            {nextTasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={task.href ?? '/checklist'}
                  className="flex items-center justify-between rounded-xl border p-4 hover:border-trust/30 hover:shadow-trust transition-all"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{task.emoji}</span>
                    <span className="font-medium">{task.title}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      </motion.div>
    </div>
  );
}