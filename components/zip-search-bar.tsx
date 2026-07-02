'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, MapPin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HUB_LIST } from '@/lib/hubs';
import { getInternalSearchUrl, type ServiceVertical } from '@/lib/sites';
import { fadeUp } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface ZipSearchBarProps {
  className?: string;
  defaultVertical?: ServiceVertical;
  showHubSwitcher?: boolean;
  coachHint?: string;
  variant?: 'hero' | 'compact' | 'inline';
}

/**
 * Primary ZIP search — routes to internal hub directories on master domain.
 * Conversational coach copy makes the first search feel guided, not clinical.
 */
export function ZipSearchBar({
  className,
  defaultVertical = 'moving',
  showHubSwitcher = true,
  coachHint = "Pop in your ZIP — we'll find verified pros near you!",
  variant = 'hero',
}: ZipSearchBarProps) {
  const router = useRouter();
  const [vertical, setVertical] = useState<ServiceVertical>(defaultVertical);
  const [zip, setZip] = useState('');
  const [focused, setFocused] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = zip.trim();
    if (trimmed) {
      router.push(getInternalSearchUrl(vertical, trimmed));
    } else {
      router.push(`/${vertical}`);
    }
  }

  const isHero = variant === 'hero';
  const isCompact = variant === 'compact';

  return (
    <motion.form
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onSubmit={handleSubmit}
      className={cn('w-full', className)}
    >
      {showHubSwitcher && (
        <div
          className="mb-4 flex justify-center gap-1 rounded-xl bg-muted/80 p-1 border border-border/50"
          role="tablist"
          aria-label="Select service type"
        >
          {HUB_LIST.map((hub) => (
            <button
              key={hub.id}
              type="button"
              role="tab"
              aria-selected={vertical === hub.id}
              onClick={() => setVertical(hub.id)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                vertical === hub.id ? 'text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
              )}
              style={vertical === hub.id ? { backgroundColor: hub.accent } : undefined}
            >
              <span className="mr-1.5" aria-hidden>{hub.emoji}</span>
              {hub.label}
            </button>
          ))}
        </div>
      )}

      {coachHint && isHero && (
        <p className="mb-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-fun" aria-hidden />
          {coachHint}
        </p>
      )}

      <motion.div
        animate={focused ? { scale: 1.01 } : { scale: 1 }}
        className={cn(
          'flex gap-2 rounded-2xl border bg-card p-2 shadow-trust-lg transition-shadow',
          focused && 'ring-2 ring-trust/30 shadow-glow'
        )}
      >
        <div className="relative flex-1">
          <MapPin
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-trust"
            aria-hidden
          />
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{5}(-[0-9]{4})?"
            placeholder="Your ZIP code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              'border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0',
              isHero ? 'h-12 text-base' : 'h-10'
            )}
            aria-label="ZIP code for local search"
            maxLength={10}
          />
        </div>
        <Button
          type="submit"
          variant="trust"
          size={isHero ? 'lg' : 'default'}
          className="gap-2 rounded-xl shrink-0"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span>{isCompact ? 'Go' : "Let's go!"}</span>
        </Button>
      </motion.div>

      {!showHubSwitcher && isCompact && (
        <div className="mt-2 flex gap-1">
          {(['moving', 'insurance', 'lending'] as ServiceVertical[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVertical(v)}
              className={cn(
                'rounded-lg px-2 py-1 text-xs font-medium capitalize transition-colors',
                vertical === v ? 'bg-trust text-white' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </motion.form>
  );
}