import Link from 'next/link';
import { customerClaimRecovery, type CustomerClaimErrorCode } from '@/lib/customer/claim-recovery';

export function ClaimRecoveryCard({ code, headingLevel = 'h1' }: { code: CustomerClaimErrorCode | string; headingLevel?: 'h1' | 'h2' }) {
  const recovery = customerClaimRecovery(code);
  const Heading = headingLevel;
  return (
    <section className="card-surface p-6" aria-labelledby="claim-recovery-title">
      <Heading id="claim-recovery-title" className="text-xl font-semibold text-navy">{recovery.headline}</Heading>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <div><h2 className="font-semibold text-foreground">What happened</h2><p className="mt-1">{recovery.whatHappened}</p></div>
        <div><h2 className="font-semibold text-foreground">Why</h2><p className="mt-1">{recovery.why}</p></div>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {recovery.actions.map((action) => (
          <Link key={`${action.kind}-${action.href}`} href={action.href} className={action.kind === 'primary' ? 'btn-primary' : 'btn-secondary'}>
            {action.label}
          </Link>
        ))}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        A review can correct a classification or profile association. It does not override publication, identity, or eligibility safeguards.
      </p>
    </section>
  );
}
