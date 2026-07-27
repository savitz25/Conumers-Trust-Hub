import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Corrections / Report an Error',
  description:
    'Report factual errors on ConsumerTrust Hub or a specialist Trust Hub. Corrections are evaluated against primary public sources.',
  path: '/corrections',
});

export default function CorrectionsPage() {
  const subject = encodeURIComponent('Correction request — ConsumerTrust Hub');
  const body = encodeURIComponent(
    [
      'URL:',
      '',
      'Claimed error:',
      '',
      'Correct fact (if known):',
      '',
      'Primary source link (FMCSA, DOI, NMLS, official filing, etc.):',
      '',
      'Your relationship (consumer / provider / journalist / other):',
      '',
    ].join('\n')
  );

  return (
    <>
      <PageHeader
        label="Corrections"
        title="Report a factual error"
        description="Material errors are reviewed against primary public sources. Commercial interest does not change editorial outcomes."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <p>
            {BRAND.name} treats accuracy as an operational requirement. Use this page to report
            factual errors on the parent site or on a specialist Trust Hub (MoveTrustHub,
            InsuranceTrustHub, LenderTrustHub).
          </p>

          <h2>What to include</h2>
          <ul>
            <li>Exact URL of the page in question</li>
            <li>The statement you believe is incorrect</li>
            <li>The correct fact, if known</li>
            <li>
              A primary source (for example FMCSA, state DOI / NAIC pathway, NMLS Consumer Access,
              or an official company filing)
            </li>
            <li>Your relationship to the matter (consumer, provider, journalist, other)</li>
          </ul>

          <h2>How reports are handled</h2>
          <ul>
            <li>Reports are reviewed against public records and cited evidence.</li>
            <li>Material factual corrections are applied when substantiated.</li>
            <li>Significant corrections may be noted on the affected page when the change could have influenced a decision.</li>
            <li>
              Provider disputes are not resolved by willingness to advertise, partner, or purchase
              placement.
            </li>
          </ul>
        </div>

        <div className="mt-10 max-w-3xl border border-border/80 p-6 sm:p-8">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Submit a correction
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Email{' '}
            <a className="link-inline" href={`mailto:${BRAND.email}`}>
              {BRAND.email}
            </a>
            . Response target: two business days.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`mailto:${BRAND.email}?subject=${subject}&body=${body}`}
              className="btn-primary"
            >
              Email a correction
            </a>
            <Link href="/editorial-standards" className="btn-secondary">
              Editorial standards
            </Link>
            <Link href="/contact" className="btn-secondary">
              General contact
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
