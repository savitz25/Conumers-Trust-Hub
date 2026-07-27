'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { NAV_PRIMARY } from '@/lib/content';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <BrandLogo />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/promise" className="btn-primary">
            Independence policy
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-border bg-background md:hidden">
          <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-4">
            {NAV_PRIMARY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-3 text-base font-medium text-foreground"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/promise" className="btn-primary mt-2" onClick={() => setOpen(false)}>
              Independence policy
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
