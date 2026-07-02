'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, PartyPopper } from 'lucide-react';
import { checkCelebrate } from '@/lib/animations';
import { CELEBRATION_MESSAGES } from '@/lib/checklist';
import { cn } from '@/lib/utils';

interface ChecklistItemProps {
  id: string;
  title: string;
  description: string;
  emoji: string;
  href?: string;
  defaultChecked?: boolean;
  onToggle?: (id: string, checked: boolean) => void;
}

/**
 * Delightful checklist row — playful check animation + random celebration toast.
 * Duolingo-style micro-reward on complete.
 */
export function ChecklistItem({
  id,
  title,
  description,
  emoji,
  href,
  defaultChecked = false,
  onToggle,
}: ChecklistItemProps) {
  const [checked, setChecked] = useState(defaultChecked);
  const [celebrate, setCelebrate] = useState(false);
  const [message, setMessage] = useState('');

  function toggle() {
    const next = !checked;
    setChecked(next);
    onToggle?.(id, next);

    if (next) {
      setMessage(CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)]);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2200);
    }
  }

  return (
    <motion.li
      layout
      className={cn(
        'group relative flex gap-4 rounded-2xl border p-4 transition-all duration-300',
        checked
          ? 'border-trust/30 bg-trust/5 opacity-80'
          : 'border-border bg-card hover:border-trust/20 hover:shadow-trust'
      )}
    >
      {/* Playful checkbox */}
      <motion.button
        type="button"
        variants={checkCelebrate}
        animate={checked ? 'checked' : 'unchecked'}
        onClick={toggle}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
          checked
            ? 'border-trust bg-trust text-white'
            : 'border-muted-foreground/30 bg-muted/50 hover:border-trust hover:bg-trust/10'
        )}
        aria-checked={checked}
        role="checkbox"
        aria-label={`Mark "${title}" as ${checked ? 'incomplete' : 'complete'}`}
      >
        <AnimatePresence mode="wait">
          {checked ? (
            <motion.span
              key="check"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
            >
              <Check className="h-5 w-5" strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span key="emoji" className="text-lg" role="img" aria-hidden>
              {emoji}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold', checked && 'line-through text-muted-foreground')}>
          {title}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>

        {href && !checked && (
          <Link
            href={href}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-trust hover:underline"
          >
            Take me there <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Celebration popover */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            className="absolute -top-2 right-4 flex items-center gap-1.5 rounded-full bg-fun px-3 py-1 text-xs font-bold text-white shadow-fun"
          >
            <PartyPopper className="h-3.5 w-3.5" aria-hidden />
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}