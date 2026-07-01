'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, ChevronDown, ExternalLink } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { UnifiedSearch } from '@/components/unified-search';
import { Button } from '@/components/ui/button';
import { SISTER_SITES } from '@/lib/sites';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/moving', label: 'Moving' },
  { href: '/lending', label: 'Lending' },
  { href: '/insurance', label: 'Insurance' },
  { href: '/resources', label: 'Resources' },
  { href: '/about', label: 'About' },
] as const;

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [directAccessOpen, setDirectAccessOpen] = useState(false);

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-3 px-4 py-2 md:min-h-[4.5rem]">
        <BrandLogo priority />

        <div className="hidden max-w-sm flex-1 lg:block">
          <UnifiedSearch compact className="[&_button]:hidden" />
        </div>

        <div className="hidden items-center gap-1 text-sm md:flex lg:gap-3">
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setDirectAccessOpen(!directAccessOpen)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={directAccessOpen}
              aria-haspopup="true"
            >
              Direct Access <ChevronDown className="h-4 w-4" />
            </button>
            {directAccessOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDirectAccessOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border bg-card py-2 shadow-trust-lg">
                  {Object.values(SISTER_SITES).map((site) => (
                    <a
                      key={site.id}
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-secondary"
                      onClick={() => setDirectAccessOpen(false)}
                    >
                      <span>
                        <span className="font-medium">{site.name}</span>
                        <span className="block text-xs text-muted-foreground">{site.verificationBadge}</span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
          {NAV_LINKS.slice(1, -1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden font-medium text-muted-foreground transition-colors hover:text-foreground xl:inline"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/moving">
            <Button size="sm" variant="trust">
              Get Started
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="rounded-lg p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t bg-background px-4 py-4 md:hidden">
          <UnifiedSearch className="mb-4" />
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Direct Access
              </p>
              {Object.values(SISTER_SITES).map((site) => (
                <a
                  key={site.id}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-2 text-sm font-medium"
                >
                  {site.name}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}