'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { ASK_NETWORK_LINKS } from '@/lib/design/ask-design-system';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Compact label for tight header slots */
  compact?: boolean;
};

/**
 * Switch Hub — routes consumers to specialist Trust Hub domains.
 * Parent-site control; specialist product nav lives on each hub.
 */
export function SwitchHubMenu({ className, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-semibold transition-colors',
          'text-[#0A2540] hover:border-[#4F46E5]/35 hover:bg-[#E0E7FF]/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2',
          open && 'border-[#4F46E5]/40 bg-[#E0E7FF]/60'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {compact ? 'Hubs' : 'Switch Hub'}
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-[#4F46E5] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label="Switch Trust Hub"
          className="absolute right-0 z-[80] mt-2 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white py-2 shadow-[0_8px_24px_-8px_rgb(10_37_64_/_0.15)]"
        >
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4F46E5]">
            Specialist hubs
          </p>
          <ul className="space-y-0.5 px-1.5">
            {ASK_NETWORK_LINKS.map((hub) => (
              <li key={hub.id}>
                <a
                  role="menuitem"
                  href={hub.href}
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-[#E0E7FF]/70"
                  onClick={() => setOpen(false)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#0A2540]">{hub.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-[#1E293B]">
                      {hub.blurb}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4F46E5]" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-1 border-t border-[#E2E8F0] px-3 pt-2 text-[11px] leading-relaxed text-[#1E293B]">
            You are on Ask Trust Hub — knowledge &amp; routing for the network.
          </p>
        </div>
      ) : null}
    </div>
  );
}
