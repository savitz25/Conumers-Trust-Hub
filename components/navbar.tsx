'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Menu, Sparkles, X } from 'lucide-react';
import { useAskChat } from '@/components/ask-chat/ask-chat-context';
import { BrandLogo } from '@/components/brand-logo';
import { SwitchHubMenu } from '@/components/switch-hub-menu';
import { ASK_HEADER_CONCIERGE, ASK_HEADER_NAV } from '@/lib/design/ask-design-system';
import { cn } from '@/lib/utils';

const XL_ONLY = new Set(['Network', 'Standard', 'Trust']);

function navActive(pathname: string, href: string) {
  if (href.startsWith('/#')) return pathname === '/';
  if (href === '/my-trust-journey') {
    return pathname === '/my-trust-journey' || pathname.startsWith('/my-trust-journey/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * VISUAL-002 Ask reference shell — one sticky header, 69 / 65 / 57.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';
  const { openChat } = useAskChat();
  const drawerId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header data-hub="ask" className="th-header sticky top-0 z-50">
      <a href="#main-content" className="th-skip">
        Skip to content
      </a>
      <div className="th-header-inner container-page">
        <BrandLogo priority />

        <nav aria-label="Primary" className="th-header-nav">
          {ASK_HEADER_NAV.map((item) => {
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('th-nav-link', XL_ONLY.has(item.label) && 'th-nav-xl', active && 'th-nav-link-active')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="th-header-actions">
          <button
            type="button"
            onClick={() => openChat()}
            className="th-btn-primary"
            title={ASK_HEADER_CONCIERGE.description}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {ASK_HEADER_CONCIERGE.label}
          </button>
          <SwitchHubMenu />
        </div>

        <div className="th-header-mobile-actions">
          <button
            type="button"
            onClick={() => openChat()}
            className="th-btn-icon-accent"
            aria-label={ASK_HEADER_CONCIERGE.label}
            title={ASK_HEADER_CONCIERGE.description}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
          </button>
          <button
            ref={closeRef}
            type="button"
            className="th-btn-icon"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={drawerId}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="th-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div id={drawerId} className="th-drawer" role="dialog" aria-modal="true" aria-label="Ask Trust Hub menu">
            <nav aria-label="Mobile" className="flex flex-col">
              {ASK_HEADER_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="th-drawer-link"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                className="th-btn-primary mt-3 w-full"
                onClick={() => {
                  setOpen(false);
                  openChat();
                }}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {ASK_HEADER_CONCIERGE.label}
              </button>
              <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                <SwitchHubMenu variant="embedded" />
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </header>
  );
}
