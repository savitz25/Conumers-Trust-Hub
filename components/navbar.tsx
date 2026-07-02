'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { HubSwitcher } from '@/components/hub-switcher';
import { ZipSearchBar } from '@/components/zip-search-bar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '/resources', label: 'Resources' },
  { href: '/checklist', label: 'Checklist' },
  { href: '/about', label: 'About' },
] as const;

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-xl"
    >
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-3 px-4 py-2 lg:min-h-[4.25rem]">
        <BrandLogo priority />

        <div className="hidden lg:flex flex-1 justify-center max-w-xl px-4">
          <HubSwitcher size="sm" />
        </div>

        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden xl:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              {link.label}
            </Link>
          ))}
          <Button size="sm" variant="outline" asChild className="rounded-xl gap-1.5">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button size="sm" variant="trust" asChild className="rounded-xl">
            <Link href="/onboarding">Start your move</Link>
          </Button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="rounded-xl p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t bg-background px-4 py-4 md:hidden space-y-4">
          <HubSwitcher />
          <ZipSearchBar variant="compact" showHubSwitcher />
          <div className="flex flex-col gap-2">
            <Link href="/" className="font-medium py-2" onClick={() => setIsOpen(false)}>Home</Link>
            <Link href="/moving" className="font-medium py-2" onClick={() => setIsOpen(false)}>Moving</Link>
            <Link href="/insurance" className="font-medium py-2" onClick={() => setIsOpen(false)}>Insurance</Link>
            <Link href="/lending" className="font-medium py-2" onClick={() => setIsOpen(false)}>Lending</Link>
            <Link href="/dashboard" className="font-medium py-2" onClick={() => setIsOpen(false)}>Dashboard</Link>
            <Link href="/concierge" className="font-medium py-2" onClick={() => setIsOpen(false)}>AI Concierge</Link>
            <Link href="/onboarding" className="font-medium py-2 text-trust" onClick={() => setIsOpen(false)}>Start your move →</Link>
          </div>
        </div>
      )}
    </nav>
  );
}