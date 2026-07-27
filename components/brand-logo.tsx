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
 * ConsumerTrustHub wordmark — links home.
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
      <span
        className={cn(
          'relative block overflow-hidden',
          inverted ? 'h-10 w-[11.5rem] sm:h-11 sm:w-[13rem]' : 'h-9 w-[10.5rem] sm:h-10 sm:w-[12rem] lg:h-11 lg:w-[13.5rem]'
        )}
      >
        <Image
          src={src}
          alt={BRAND_LOGO.alt}
          width={BRAND_LOGO.width}
          height={BRAND_LOGO.height}
          priority={priority}
          className="h-full w-full object-contain object-left"
          sizes="(max-width: 640px) 168px, 216px"
        />
      </span>
    </Link>
  );
}
