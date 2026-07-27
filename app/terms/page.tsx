import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Terms of Service',
  description: `Terms of service for ${BRAND.name} (${BRAND.domain}).`,
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <PageHeader
        label="Legal"
        title="Terms of Service"
        description={`Last updated: July 1, 2026 · Applies to ${BRAND.domain}`}
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <h2>Agreement</h2>
          <p>
            By using {BRAND.domain}, you agree to these terms. If you do not agree, do not use the
            site.
          </p>

          <h2>Informational purpose only</h2>
          <p>
            {BRAND.name} provides independent informational content about a network of consumer
            research sites. Nothing on this site is legal, financial, insurance, or moving advice.
            Always verify licensing and terms with primary regulators and providers before you
            commit.
          </p>

          <h2>No paid placements</h2>
          <p>
            Network policy prohibits paid ranking placements that alter organic research ordering.
            Commercial relationships, if any, will be disclosed and isolated from Trust Scores and
            editorial ranking.
          </p>

          <h2>No professional relationship</h2>
          <p>
            Use of this site does not create a broker, agent, fiduciary, or advisory relationship
            between you and {BRAND.name}.
          </p>

          <h2>Intellectual property</h2>
          <p>
            Site design, branding, and original content are owned by {BRAND.name} or its licensors.
            You may not copy or redistribute substantial portions without permission, except for
            fair use quotation with attribution.
          </p>

          <h2>Third-party links</h2>
          <p>
            We link to specialist Trust Hubs and external sources. We are not responsible for
            third-party content, availability, or practices.
          </p>

          <h2>Disclaimer of warranties</h2>
          <p>
            The site is provided “as is” without warranties of any kind, express or implied,
            including accuracy, completeness, or fitness for a particular purpose. Public data may be
            incomplete or outdated.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, {BRAND.name} is not liable for any indirect,
            incidental, special, consequential, or punitive damages, or any loss arising from your
            use of the site or reliance on its content.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms. Continued use after changes constitutes acceptance of the
            revised terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions: {BRAND.email}
          </p>
        </div>
      </div>
    </>
  );
}
