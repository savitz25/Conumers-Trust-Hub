'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, PartyPopper } from 'lucide-react';
import { LEGACY_DOMAINS, type LegacySource } from '@/lib/brand';
import { Button } from '@/components/ui/button';

const SOURCE_MAP: Record<string, LegacySource> = {
  movetrusthub: 'moving',
  'move-trust': 'moving',
  lendertrusthub: 'lending',
  'lender-trust': 'lending',
  insurancetrusthub: 'insurance',
  'insurance-trust': 'insurance',
};

/**
 * Transitional welcome banner for legacy 308 redirect arrivals.
 * Activate via ?from=movetrusthub (or utm_source) — ready for redirect "go" day.
 */
export function WelcomeBanner() {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const [source, setSource] = useState<LegacySource | null>(null);

  useEffect(() => {
    const from =
      searchParams.get('from') ??
      searchParams.get('utm_source') ??
      searchParams.get('ref') ??
      '';

    const normalized = from.toLowerCase().replace(/\.com|www\./g, '');
    const matched = Object.entries(SOURCE_MAP).find(([key]) => normalized.includes(key));
    if (matched) {
      setSource(matched[1]);
      // Persist once per session so refresh doesn't nag
      const key = `cth-welcome-${matched[1]}`;
      if (sessionStorage.getItem(key)) {
        setDismissed(true);
      }
    }
  }, [searchParams]);

  if (!source || dismissed) return null;

  const legacy = LEGACY_DOMAINS[source];

  function handleDismiss() {
    sessionStorage.setItem(`cth-welcome-${source}`, '1');
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden border-b border-trust/20 bg-gradient-to-r from-trust/10 via-fun/10 to-trust/5"
        role="alert"
        aria-live="polite"
      >
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
            >
              <PartyPopper className="h-5 w-5 text-fun shrink-0" aria-hidden />
            </motion.div>
            <p className="text-sm font-medium text-foreground">
              <Sparkles className="inline h-4 w-4 text-fun mr-1" aria-hidden />
              Welcome from <strong>{legacy.brand}</strong> {legacy.emoji} Everything you need is
              now here — same trusted data, one beautiful home!
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="trust" asChild>
              <a href="/onboarding">Start your journey</a>
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg p-1.5 hover:bg-muted transition-colors"
              aria-label="Dismiss welcome message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}