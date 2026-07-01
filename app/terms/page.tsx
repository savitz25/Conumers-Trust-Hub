import { createPageMetadata } from '@/lib/seo/metadata';
import { CONSUMERS_TRUST_HUB } from '@/lib/sites';

export const metadata = createPageMetadata({
  title: 'Terms of Service',
  description: 'Terms of service for Consumers Trust Hub — independent consumer directory platform.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-3xl prose prose-slate dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: January 1, 2026</p>

        <h2>Agreement</h2>
        <p>
          By using {CONSUMERS_TRUST_HUB.name} at consumerstrusthub.com, you agree to these terms.
          If you do not agree, please do not use our services.
        </p>

        <h2>Nature of Service</h2>
        <p>
          We provide an informational umbrella platform connecting consumers to independent
          directories for moving companies, mortgage lenders, and insurance agents. We are not a
          mover, lender, broker, insurer, or financial advisor. Directory data is for research
          purposes only.
        </p>

        <h2>No Paid Placements</h2>
        <p>
          Listings on our sister sites are not for sale. Rankings reflect verification data and
          transparent scoring methodology — never sponsorship or advertising fees.
        </p>

        <h2>Accuracy Disclaimer</h2>
        <p>
          We strive for accurate, up-to-date licensing and review data but cannot guarantee
          completeness. Users must independently verify FMCSA, NMLS, and state DOI records before
          entering contracts or making financial commitments.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          {CONSUMERS_TRUST_HUB.name} and its operators are not liable for damages arising from
          decisions made based on directory information, third-party site content, or provider
          interactions initiated through our platform.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: <a href={`mailto:${CONSUMERS_TRUST_HUB.email}`}>{CONSUMERS_TRUST_HUB.email}</a>
        </p>
      </div>
    </div>
  );
}