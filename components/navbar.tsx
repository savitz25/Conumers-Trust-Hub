'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, Search, Sparkles, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { SwitchHubMenu } from '@/components/switch-hub-menu';
import {
  ASK_BRAND,
  ASK_HEADER_CONCIERGE,
  ASK_HEADER_NAV,
} from '@/lib/design/ask-design-system';
import { cn } from '@/lib/utils';

/**
 * Ask Trust Hub primary header — Phase 1.
 * Logo · knowledge nav · AI Concierge entry · Switch Hub · mobile drawer.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';

  return (
    <header
      data-hub="ask"
      className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90"
    >
      <div className="container-page relative flex h-16 items-center justify-between gap-3 sm:h-[4.5rem] sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo priority />
          <span className="hidden max-w-[7.5rem] text-[10px] font-semibold leading-tight tracking-wide text-[#0A2540] xl:block">
            Knowledge &amp; concierge
          </span>
        </div>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {ASK_HEADER_NAV.map((item) => {
            const active =
              item.href.startsWith('/#')
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-2.5 py-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2',
                  active
                    ? 'text-[#4F46E5]'
                    : 'text-[#0A2540] hover:text-[#4F46E5]'
                )}
                style={{ color: active ? ASK_BRAND.indigo : ASK_BRAND.navy }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={ASK_HEADER_CONCIERGE.href}
            className="ask-cta hidden min-h-10 items-center gap-2 sm:inline-flex"
            title={ASK_HEADER_CONCIERGE.description}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {ASK_HEADER_CONCIERGE.label}
          </Link>
          <Link
            href={ASK_HEADER_CONCIERGE.href}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#E0E7FF]/50 px-3 py-2 text-sm font-semibold text-[#0A2540] transition-colors hover:border-[#4F46E5]/30 hover:bg-[#E0E7FF] lg:hidden"
            title={ASK_HEADER_CONCIERGE.description}
          >
            <Search className="h-4 w-4 text-[#4F46E5]" aria-hidden />
            Ask
          </Link>
          <SwitchHubMenu />
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
          <Link
            href={ASK_HEADER_CONCIERGE.href}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-[#4F46E5] text-white"
            aria-label={ASK_HEADER_CONCIERGE.label}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#0A2540]"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-[#E2E8F0] bg-white md:hidden"
        >
          <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-4">
            {ASK_HEADER_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-2 py-3 text-base font-semibold text-[#0A2540] hover:bg-[#E0E7FF]/60 hover:text-[#4F46E5]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={ASK_HEADER_CONCIERGE.href}
              className="ask-cta mt-2 w-full"
              onClick={() => setOpen(false)}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {ASK_HEADER_CONCIERGE.label}
            </Link>
            <div className="mt-3 border-t border-[#E2E8F0] pt-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4F46E5]">
                Switch Hub
              </p>
              <SwitchHubMenu className="w-full [&>button]:w-full [&>button]:justify-center" />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
