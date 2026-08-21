'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TH_HUB_ACCENT } from '@/lib/design/trusthub-visual-standard';
import { NETWORK_REGISTRY, switcherEntries } from '@/lib/network/registry';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Drawer: list only, no trigger. Header: dropdown. */
  variant?: 'dropdown' | 'embedded';
};

function HubRows({ onPick }: { onPick?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {switcherEntries().map((hub) => {
        const current = hub.id === 'ask';
        return (
          <li key={hub.id}>
            <a
              role="menuitem"
              href={hub.url}
              aria-current={current ? 'page' : undefined}
              rel={current ? undefined : 'noopener noreferrer'}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors',
                'hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)]',
                current && 'bg-[#F8FAFC]'
              )}
              onClick={onPick}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: TH_HUB_ACCENT[hub.id] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0A2540]">{hub.name}</span>
                  {current ? (
                    <span className="rounded-md bg-[#0A2540] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Current
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-[#1E293B]">
                  {hub.switcherLabel}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * TrustHub Network Navigator — NETWORK_REGISTRY switcherLabel only.
 */
export function SwitchHubMenu({ className, variant = 'dropdown' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (variant !== 'dropdown') return;
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
  }, [variant]);

  if (variant === 'embedded') {
    return (
      <div className={cn('th-network-panel-embed', className)}>
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A2540]">
          ASK TRUST HUB NETWORK
        </p>
        <HubRows />
        <p className="mt-2 border-t border-[#E2E8F0] px-1 pt-2 text-[11px] leading-relaxed text-[#1E293B]">
          You are on {NETWORK_REGISTRY.ask.name} — {NETWORK_REGISTRY.ask.switcherLabel}.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn('th-btn-secondary', open && 'border-[#4F46E5]/40 bg-[#E0E7FF]/50')}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        Switch Hub
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-[#0A2540] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label="Ask Trust Hub Network"
          className="th-network-panel absolute right-0 z-[80] mt-2 w-[min(100vw-2rem,20.5rem)]"
        >
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A2540]">
            ASK TRUST HUB NETWORK
          </p>
          <div className="px-1.5">
            <HubRows onPick={() => setOpen(false)} />
          </div>
          <p className="mt-1 border-t border-[#E2E8F0] px-3 pt-2 text-[11px] leading-relaxed text-[#1E293B]">
            You are on {NETWORK_REGISTRY.ask.name} — {NETWORK_REGISTRY.ask.switcherLabel}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
