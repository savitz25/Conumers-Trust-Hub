import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND, BRAND_LOGO } from '@/lib/brand';

interface BrandLogoProps {
  className?: string;
  /** Use light/glow wordmark on dark backgrounds (footer). */
  inverted?: boolean;
  priority?: boolean;
}

/**
 * Ask Trust Hub wordmark — multi-node transparent lockup.
 * Header: .hub-logo-slot (10rem → 12.5rem → 15rem × 3rem)
 * Footer: h-12 w-[192px]
 */
export function BrandLogo({ className, inverted = false, priority = false }: BrandLogoProps) {
  const src = inverted ? BRAND_LOGO.lightSrc : BRAND_LOGO.headerSrc || BRAND_LOGO.src;
  const isHeader = !inverted;
  const displayW = isHeader ? 240 : 192;
  const displayH = isHeader ? 65 : 52;

  return (
    <Link
      href="/"
      className={cn(
        'group flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2',
        inverted && 'focus-visible:ring-offset-[#0A2540]',
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
