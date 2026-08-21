import Link from 'next/link';
import { AskNetworkMark } from '@/components/ask-network-mark';
import { cn } from '@/lib/utils';
import { BRAND, BRAND_LOGO } from '@/lib/brand';

interface BrandLogoProps {
  className?: string;
  /** Use light/glow wordmark on dark backgrounds (footer). */
  inverted?: boolean;
  priority?: boolean;
}

/**
 * Header: tight mark + two-line wordmark in the optical logo slot (36/33/30).
 * Footer: existing inverted PNG lockup (not the 36px chrome slot).
 */
export function BrandLogo({ className, inverted = false }: BrandLogoProps) {
  if (inverted) {
    return (
      <Link
        href="/"
        className={cn(
          'group flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A2540]',
          className
        )}
        aria-label={`${BRAND.name} home`}
      >
        <span className="relative block h-12 w-[192px] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_LOGO.lightSrc}
            alt={BRAND_LOGO.alt}
            width={192}
            height={52}
            loading="lazy"
            decoding="async"
            className="h-12 w-[192px] bg-transparent object-contain object-left"
          />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className={cn(
        'group th-logo-lockup flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-accent)] focus-visible:ring-offset-2',
        className
      )}
      aria-label={`${BRAND.name} home`}
    >
      <AskNetworkMark className="th-logo-mark" />
      <span className="th-logo-wordmark">
        <span className="th-logo-ask">ASK</span>
        <span className="th-logo-hub">TRUST HUB</span>
      </span>
    </Link>
  );
}
