import { Shield, BadgeCheck, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type VerificationType = 'FMCSA' | 'NMLS' | 'DOI' | 'BBB' | 'verified' | 'independent';

const BADGE_CONFIG: Record<VerificationType, { label: string; className: string }> = {
  FMCSA: { label: 'FMCSA Verified', className: 'trust-badge-verified' },
  NMLS: { label: 'NMLS Verified', className: 'trust-badge-verified' },
  DOI: { label: 'DOI Verified', className: 'trust-badge-verified' },
  BBB: { label: 'BBB Rated', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300' },
  verified: { label: 'Verified', className: 'trust-badge-verified' },
  independent: {
    label: 'Independent · Zero Paid Placements',
    className: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200',
  },
};

interface TrustBadgeProps {
  type: VerificationType;
  className?: string;
  showIcon?: boolean;
  score?: number;
}

/**
 * Verification chip — used on cards, heroes, directory rows.
 * Optional trust score (0–100) displays as compact ring text.
 */
export function TrustBadge({ type, className, showIcon = true, score }: TrustBadgeProps) {
  const config = BADGE_CONFIG[type];

  return (
    <span
      className={cn('trust-badge', config.className, className)}
      role="status"
      aria-label={`${config.label}${score != null ? `, trust score ${score} out of 100` : ''}`}
    >
      {showIcon && (
        type === 'independent' ? (
          <Star className="h-3 w-3" aria-hidden />
        ) : (
          <BadgeCheck className="h-3 w-3" aria-hidden />
        )
      )}
      {config.label}
      {score != null && (
        <span className="ml-1 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
          {score}
        </span>
      )}
    </span>
  );
}

/** Row of verification sources for trust proof sections */
export function TrustProofRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-3">
      {items.map((item) => (
        <span key={item} className="trust-badge trust-badge-verified">
          <Shield className="h-3 w-3" aria-hidden />
          {item}
        </span>
      ))}
    </div>
  );
}