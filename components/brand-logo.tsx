import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
  variant?: 'default' | 'stacked';
}

export function BrandLogo({ className, priority = false, variant = 'default' }: BrandLogoProps) {
  if (variant === 'stacked') {
    return (
      <Link href="/" className={cn('inline-flex flex-col items-start gap-0.5', className)} aria-label="Consumers Trust Hub home">
        <Image
          src="/brand/logo.svg"
          alt="Consumers Trust Hub"
          width={200}
          height={48}
          priority={priority}
          className="h-10 w-auto"
        />
      </Link>
    );
  }

  return (
    <Link href="/" className={cn('inline-flex items-center', className)} aria-label="Consumers Trust Hub home">
      <Image
        src="/brand/logo.svg"
        alt="Consumers Trust Hub"
        width={220}
        height={48}
        priority={priority}
        className="h-9 w-auto md:h-10"
      />
    </Link>
  );
}