import Link from 'next/link';
import {
  ASK_NETWORK_STANDARD_LABEL,
  ASK_NETWORK_STANDARD_LABEL_LONG,
  ASK_NETWORK_STANDARD_TOOLTIP,
} from '@/lib/network/standard-version';
import { cn } from '@/lib/utils';

export type TrustMarkProps = {
  className?: string;
  variant?: 'chip' | 'text' | 'inline';
  /** Use absolute URL when linking from external hubs; Ask uses internal path by default. */
  external?: boolean;
};

/**
 * Canonical Ask Trust Hub Standard mark (parent site).
 * Always resolves to /methodology on Ask.
 */
export function TrustMark({ className, variant = 'chip', external = false }: TrustMarkProps) {
  const href = external ? 'https://www.asktrusthub.com/methodology' : '/methodology';
  const label =
    variant === 'text' ? ASK_NETWORK_STANDARD_LABEL_LONG : ASK_NETWORK_STANDARD_LABEL;

  const classes =
    variant === 'chip'
      ? cn(
          'inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5',
          'text-[11px] font-semibold tracking-wide text-muted-foreground',
          'transition-colors hover:border-navy/30 hover:text-foreground',
          className
        )
      : cn(
          'text-xs font-medium text-muted-foreground underline-offset-2 hover:underline',
          variant === 'inline' && 'font-semibold',
          className
        );

  if (external) {
    return (
      <a
        href={href}
        className={classes}
        rel="noopener noreferrer"
        title={ASK_NETWORK_STANDARD_TOOLTIP}
        aria-label={ASK_NETWORK_STANDARD_LABEL}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={classes}
      title={ASK_NETWORK_STANDARD_TOOLTIP}
      aria-label={ASK_NETWORK_STANDARD_LABEL}
    >
      {label}
    </Link>
  );
}

export const TrustStandardMark = TrustMark;
export const AskTrustHubStandardChip = TrustMark;
