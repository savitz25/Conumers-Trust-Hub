import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Privacy Policy',
  description: `Privacy policy for ${BRAND.name} (${BRAND.domain}).`,
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        label="Legal"
        title="Privacy Policy"
        description={`Last updated: July 1, 2026 · Applies to ${BRAND.domain}`}
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <h2>Overview</h2>
          <p>
            {BRAND.name} (“we,” “us,” or “our”) operates {BRAND.domain}. This policy describes how
            we collect, use, and protect information on the parent network site. Specialist Trust
            Hubs may publish additional notices for their own features.
          </p>

          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Usage data:</strong> pages visited, approximate location derived from IP,
              device/browser type, and referral source via analytics.
            </li>
            <li>
              <strong>Contact data:</strong> name, email, and message content when you email us.
            </li>
            <li>
              <strong>Technical cookies:</strong> essential site operation and, if enabled, privacy-
              respectful analytics.
            </li>
          </ul>

          <h2>How we use information</h2>
          <p>
            We use information to operate and improve the site, respond to inquiries, measure
            performance, and protect against abuse. We do not sell personal information.
          </p>

          <h2>Analytics</h2>
          <p>
            We may use Vercel Analytics and/or Google Analytics to understand aggregate traffic. You
            can block analytics via browser settings or extensions. Cross-domain measurement may
            include specialist Trust Hub domains when configured.
          </p>

          <h2>Third-party sites</h2>
          <p>
            Links to MoveTrustHub, InsuranceTrustHub, LenderTrustHub, and external regulators leave
            this site. Their privacy practices are governed by their own policies.
          </p>

          <h2>Data retention</h2>
          <p>
            Contact emails are retained as long as needed to resolve the inquiry and maintain a
            reasonable compliance record. Analytics data is retained according to the analytics
            provider’s configuration.
          </p>

          <h2>Your choices</h2>
          <p>
            To request access or deletion of personal information you have sent us, email{' '}
            <a className="link-inline" href={`mailto:${BRAND.email}`}>
              {BRAND.email}
            </a>
            . We will respond within a reasonable period consistent with applicable law.
          </p>

          <h2>Contact</h2>
          <p>
            Privacy questions: {BRAND.email}
          </p>
        </div>
      </div>
    </>
  );
}
