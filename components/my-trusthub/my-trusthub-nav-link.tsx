'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const SUPABASE_URL = process.env.NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL;

/**
 * Signed-in hint for the header entry only. The browser-readable Supabase SSR
 * cookie decides the destination; every /my page still verifies the session
 * server-side, so a stale cookie only costs one redirect to /my/sign-in.
 */
export function hasMyTrustHubSessionCookie(cookie: string, supabaseUrl = SUPABASE_URL): boolean {
  let ref = '';
  try {
    ref = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : '';
  } catch {
    ref = '';
  }
  if (!ref) return false;
  const prefix = `sb-${ref}-auth-token`;
  return cookie.split(';').some((part) => part.trim().startsWith(prefix));
}

type Variant = 'desktop' | 'mobile-header' | 'drawer';

export function MyTrustHubNavLink({
  variant,
  onNavigate,
  className,
}: {
  variant: Variant;
  onNavigate?: () => void;
  className?: string;
}) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    try {
      setSignedIn(hasMyTrustHubSessionCookie(document.cookie));
    } catch {
      setSignedIn(false);
    }
  }, []);
  const href = signedIn ? '/my' : '/my/sign-in';
  const title = signedIn ? 'My TrustHub — your saved research' : 'My TrustHub — sign in to your account';

  if (variant === 'mobile-header') {
    return (
      <Link
        href={href}
        prefetch={false}
        onClick={onNavigate}
        className={cn('th-btn-icon', className)}
        aria-label="My TrustHub"
        title={title}
        data-mth-entry={signedIn ? 'workspace' : 'sign-in'}
      >
        <ShieldCheck className="h-5 w-5" aria-hidden />
      </Link>
    );
  }

  if (variant === 'drawer') {
    return (
      <Link
        href={href}
        prefetch={false}
        onClick={onNavigate}
        className={cn('th-drawer-link', className)}
        title={title}
        data-mth-entry={signedIn ? 'workspace' : 'sign-in'}
      >
        <ShieldCheck className="mr-2 h-4 w-4 text-[var(--th-accent)]" aria-hidden />
        My TrustHub
      </Link>
    );
  }

  // The reference shell caps at 1200px and shows all nine nav links from
  // 1280px, which leaves ~130px beside Concierge and Switch Hub. Keep the
  // label, but compact the control there so the primary nav never overlaps.
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onNavigate}
      className={cn('th-btn-secondary min-[1280px]:!gap-1.5 min-[1280px]:!px-2.5 min-[1280px]:!text-[13px]', className)}
      title={title}
      aria-label="My TrustHub"
      data-mth-entry={signedIn ? 'workspace' : 'sign-in'}
    >
      <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--th-accent)]" aria-hidden />
      <span>My TrustHub</span>
    </Link>
  );
}
