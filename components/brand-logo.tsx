import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND, BRAND_LOGO } from '@/lib/brand';

interface BrandLogoProps {
  className?: string;
  /** Use light wordmark on dark backgrounds (footer). */
  inverted?: boolean;
  priority?: boolean;
}

/**
 * Ask Trust Hub wordmark — same slot sizing as Move / Insurance / Lender hubs.
 * Header: .hub-logo-slot (10rem → 12.5rem → 15rem × 3rem)
 * Footer: h-12 w-[192px] (matches TrustHubLogoImage footer)
 */
export function BrandLogo({ className, inverted = false, priority = false }: BrandLogoProps) {
  const src = inverted ? BRAND_LOGO.lightSrc : BRAND_LOGO.src;
  const isHeader = !inverted;
  const displayW = isHeader ? 240 : 192;
  const displayH = isHeader ? 65 : 52;

  return (
    <Link
      href="/"
      className={cn(
        'group flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust focus-visible:ring-offset-2',
        inverted && 'focus-visible:ring-offset-navy',
        className
      )}
      aria-label={`${BRAND.name} home`}
    >
      <span
        className={cn(
          'relative block shrink-0 bg-transparent',
          isHeader ? 'hub-logo-slot' : 'h-12 w-[192px]'
        )}
      >
        {/* Native img preserves alpha; matches specialist hub logo rendering */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={BRAND_LOGO.alt}
          width={displayW}
          height={displayH}
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={cn(
            'object-contain object-left bg-transparent',
            isHeader ? 'h-full w-full' : 'h-12 w-[192px]'
          )}
        />
      </span>
    </Link>
  );
}
