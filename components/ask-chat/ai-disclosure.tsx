import Link from 'next/link';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** denser line for tight UI (chat footer) */
  compact?: boolean;
};

/**
 * Visible AI Concierge disclosure — not a tooltip.
 * Required at the point of use for AI-generated guidance.
 */
export function AiConciergeDisclosure({ className, compact = false }: Props) {
  return (
    <p
      className={cn(
        'leading-snug',
        compact ? 'text-[11px]' : 'text-xs sm:text-sm',
        className
      )}
      style={{ color: ASK_BRAND.ink }}
      role="note"
    >
      {compact ? (
        <>
          Responses are <strong className="font-semibold">AI-generated</strong>. Verify important
          facts against primary sources.{' '}
          <Link
            href="/editorial-standards"
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: ASK_BRAND.indigo }}
          >
            Editorial Standards
          </Link>
          .
        </>
      ) : (
        <>
          <strong className="font-semibold">AI-generated guidance.</strong> The Concierge uses AI to
          help route and explain research. Always verify important facts against primary sources
          (FMCSA, NMLS, state DOI/NAIC, and the company itself).{' '}
          <Link
            href="/editorial-standards"
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: ASK_BRAND.indigo }}
          >
            Editorial Standards
          </Link>
        </>
      )}
    </p>
  );
}
