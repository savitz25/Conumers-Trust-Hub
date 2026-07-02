import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn('inline-flex items-center gap-2 group', className)}
      aria-label={`${BRAND.name} home`}
    >
      <Image
        src="/brand/logo.svg"
        alt=""
        width={36}
        height={36}
        priority={priority}
        className="h-9 w-9 transition-transform group-hover:scale-105"
        aria-hidden
      />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-foreground">ConsumerTrust</span>
        <span className="text-[11px] font-semibold text-trust">Hub</span>
      </div>
    </Link>
  );
}