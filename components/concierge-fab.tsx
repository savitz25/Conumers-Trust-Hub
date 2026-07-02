'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';
import { conciergePulse } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface ConciergeFabProps {
  className?: string;
}

/**
 * Floating AI Concierge entry — persistent coach companion.
 * Links to /concierge; pulses gently to invite first-time users.
 */
export function ConciergeFab({ className }: ConciergeFabProps) {
  return (
    <motion.div
      className={cn('fixed bottom-6 right-6 z-50', className)}
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.div variants={conciergePulse} animate="pulse" className="rounded-full">
        <Link
          href="/concierge"
          className="group flex items-center gap-2 rounded-full bg-trust pl-4 pr-5 py-3.5 text-white font-semibold shadow-glow transition-transform hover:scale-105 active:scale-95"
          aria-label="Open AI Relocation Concierge"
        >
          <span className="relative">
            <MessageCircle className="h-5 w-5" aria-hidden />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-fun animate-pulse" aria-hidden />
          </span>
          <span className="hidden sm:inline text-sm">Ask your move coach</span>
        </Link>
      </motion.div>

      {/* Tooltip for mobile-first users */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="mt-2 text-center text-[10px] font-medium text-muted-foreground sm:hidden"
      >
        Need help? Tap me!
      </motion.p>
    </motion.div>
  );
}