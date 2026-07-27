import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

interface BrandLogoProps {
  className?: string;
  inverted?: boolean;
}

export function BrandLogo({ className, inverted = false }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn('inline-flex items-center gap-2.5 group', className)}
      aria-label={`${BRAND.name} home`}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8 shrink-0"
        aria-hidden
      >
        <rect width="48" height="48" rx="10" fill={inverted ? '#FFFFFF' : '#0A2540'} />
        <path
          d="M14 30.5V17.5L24 12l10 5.5v13L24 36l-10-5.5z"
          stroke={inverted ? '#0A2540' : '#14B8A6'}
          strokeWidth="1.75"
          fill="none"
        />
        <path
          d="M24 18.5l5.5 3v6L24 30.5l-5.5-3v-6l5.5-3z"
          fill={inverted ? '#0D9488' : '#14B8A6'}
        />
      </svg>
      <span
        className={cn(
          'text-[15px] font-semibold tracking-tight',
          inverted ? 'text-white' : 'text-navy'
        )}
      >
        ConsumerTrust<span className={inverted ? 'text-white/70' : 'text-trust'}>Hub</span>
      </span>
    </Link>
  );
}
