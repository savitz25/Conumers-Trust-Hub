import Image from 'next/image';
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
 * Ask Trust Hub wordmark — links home.
 * Header: full-color transparent PNG. Footer (inverted): light variant for navy.
 */
export function BrandLogo({ className, inverted = false, priority = false }: BrandLogoProps) {
  const src = inverted ? BRAND_LOGO.lightSrc : BRAND_LOGO.src;

  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust focus-visible:ring-offset-2 rounded-sm',
        inverted && 'focus-visible:ring-offset-navy',
        className
      )}
      aria-label={`${BRAND.name} home`}
    >
      {/* Stacked wordmark needs more height than previous horizontal marks */}
      <span
        className={cn(
          'relative block overflow-hidden',
          inverted
            ? 'h-12 w-[5.5rem] sm:h-14 sm:w-[6.25rem]'
            : 'h-11 w-[5.25rem] sm:h-12 sm:w-[5.75rem] lg:h-14 lg:w-[6.5rem]'
        )}
      >
        <Image
          src={src}
          alt={BRAND_LOGO.alt}
          width={BRAND_LOGO.width}
          height={BRAND_LOGO.height}
          priority={priority}
          className="h-full w-full object-contain object-left"
          sizes="(max-width: 640px) 84px, 104px"
        />
      </span>
    </Link>
  );
}
