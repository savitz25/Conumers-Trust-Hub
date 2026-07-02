'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Truck, Shield, Landmark } from 'lucide-react';
import { HUB_LIST } from '@/lib/hubs';
import { cn } from '@/lib/utils';

const HUB_ICONS = {
  moving: Truck,
  insurance: Shield,
  lending: Landmark,
} as const;

interface HubSwitcherProps {
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Segmented hub control — accent colors per vertical.
 * Sticky context: highlights active hub from pathname.
 */
export function HubSwitcher({ className, size = 'md' }: HubSwitcherProps) {
  const pathname = usePathname();

  const activeId = HUB_LIST.find((h) => pathname.startsWith(h.path))?.id ?? null;

  return (
    <nav
      aria-label="Switch between Moving, Insurance, and Lending hubs"
      className={cn(
        'inline-flex rounded-xl bg-muted/80 p-1 backdrop-blur-sm border border-border/50',
        size === 'sm' ? 'gap-0.5' : 'gap-1',
        className
      )}
      role="tablist"
    >
      {HUB_LIST.map((hub) => {
        const Icon = HUB_ICONS[hub.id];
        const isActive = activeId === hub.id;

        return (
          <Link
            key={hub.id}
            href={hub.path}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg font-semibold transition-colors',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="hub-switcher-pill"
                className="absolute inset-0 rounded-lg shadow-md"
                style={{ backgroundColor: hub.accent }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
              <span className="hidden sm:inline">{hub.label}</span>
              <span className="sm:hidden">{hub.emoji}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Sub-brand header lockup for hub pages */
export function HubBrandHeader({
  hub,
}: {
  hub: { subBrand: string; poweredBy: string; accent: string; emoji: string };
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-2xl" role="img" aria-hidden>{hub.emoji}</span>
        <h2 className="text-xl font-bold" style={{ color: hub.accent }}>
          {hub.subBrand}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{hub.poweredBy}</p>
    </div>
  );
}