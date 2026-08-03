import { Mail } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Contact',
  description:
    'Contact Ask Trust Hub for corrections, methodology questions, press, and partnership inquiries.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <PageHeader
        label="Contact"
        title="Reach the network"
        description="Corrections, methodology questions, press, and partnership notes. We respond within two business days."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card-surface p-6 lg:col-span-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-trust/10 text-trust">
              <Mail className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">Email</h2>
            <a href={`mailto:${BRAND.email}`} className="link-inline mt-2 inline-block text-base">
              {BRAND.email}
            </a>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Best for corrections, data disputes, press, and general network questions.
            </p>
          </div>

          <div className="card-surface p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              What to include for a correction
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                <span>Exact URL on Ask Trust Hub or a specialist Trust Hub</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                <span>What you believe is wrong, with the correct fact if known</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                <span>Primary source link (FMCSA, DOI, NMLS, official company filing, etc.)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                <span>Your relationship to the matter (consumer, provider, journalist)</span>
              </li>
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Provider disputes are evaluated against public records. Willingness to advertise or
              “partner” does not change editorial outcomes.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
