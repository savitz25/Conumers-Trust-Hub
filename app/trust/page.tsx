import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TRUST_CENTER_LINKS } from '@/lib/situations';

export const metadata = createPageMetadata({
  title: 'Trust Center',
  description:
    'Ask Trust Hub Trust Center: independence policy, methodology, data sources, editorial standards, revenue disclosure, and corrections.',
  path: '/trust',
});

/**
 * Trust Center index — canonical list of network standards pages on Ask.
 */
export default function TrustCenterPage() {
  return (
    <>
      <PageHeader
        label="Trust Center"
        title="Standards for the whole network"
        description="Independence, methodology, funding, and corrections — owned once on Ask Trust Hub. Specialist hubs apply these rules in their markets."
      />

      <div className="container-page py-14 sm:py-16">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_CENTER_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex h-full flex-col rounded-xl border border-border/80 bg-background p-5 transition-colors hover:border-navy/20 hover:bg-muted/20"
              >
                <span className="font-semibold text-foreground">{item.label}</span>
                <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.detail}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
