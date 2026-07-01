import { createPageMetadata } from '@/lib/seo/metadata';
import { CONSUMERS_TRUST_HUB } from '@/lib/sites';

export const metadata = createPageMetadata({
  title: 'Privacy Policy',
  description: 'Unified privacy policy for Consumers Trust Hub and its sister directory sites.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-3xl prose prose-slate dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: January 1, 2026</p>

        <h2>Overview</h2>
        <p>
          {CONSUMERS_TRUST_HUB.name} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates
          consumerstrusthub.com and connects users to Move Trust Hub, Lender Trust Hub, and Insurance
          Trust Hub. This policy describes how we collect, use, and protect information across our
          umbrella platform.
        </p>

        <h2>Information We Collect</h2>
        <ul>
          <li><strong>Usage data:</strong> Pages visited, referral source, device type, and approximate location (via analytics).</li>
          <li><strong>Search queries:</strong> ZIP codes entered for directory searches (not stored unless you create an account).</li>
          <li><strong>Contact form:</strong> Name, email, and message content when you reach out to us.</li>
          <li><strong>Cookies:</strong> Analytics cookies (Google Analytics 4) and theme preference (local storage).</li>
        </ul>

        <h2>How We Use Information</h2>
        <p>
          We use collected data to improve directory experiences, measure cross-site navigation,
          respond to inquiries, and maintain platform security. We do not sell personal information
          to third parties.
        </p>

        <h2>Cross-Domain Analytics</h2>
        <p>
          We use Google Analytics 4 with cross-domain tracking across consumerstrusthub.com,
          movetrusthub.com, lendertrusthub.com, and insurancetrusthub.com to understand how users
          navigate the Trust Hub family. You may opt out via Google&apos;s Ads Settings or browser
          extensions that block analytics.
        </p>

        <h2>Third-Party Sites</h2>
        <p>
          Our sister sites maintain their own privacy practices. When you click through to
          Move Trust Hub, Lender Trust Hub, or Insurance Trust Hub, their respective policies apply.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy questions: <a href={`mailto:${CONSUMERS_TRUST_HUB.email}`}>{CONSUMERS_TRUST_HUB.email}</a>
        </p>
      </div>
    </div>
  );
}