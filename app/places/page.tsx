import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { listPlaceLensIndex } from '@/lib/network/place-lens';
import { createPageMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: 'Place Lens — Explore a place across the TrustHub Network',
  description:
    'Florida Place Lens plus New Jersey and California network gateways to specialist research. Capability is not a county grade.',
  path: '/places',
});

export default function PlacesIndexPage() {
  return (
    <>
      <PageHeader
        label="Place Lens"
        title="Explore a place across the TrustHub Network"
        description="Start with Florida Place Lens, enhanced counties where published, or the New Jersey and California network gateways. Capability is not a market score."
      />
      <div className="container-page py-10 sm:py-14">
        <ul className="grid gap-4 sm:grid-cols-3">
          {listPlaceLensIndex().map((item) => (
            <li key={item.href} className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
              <h2 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                {item.label}
              </h2>
              <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
                {item.detail}
              </p>
              <Link href={item.href} className="mt-4 inline-flex min-h-11 items-center font-semibold" style={{ color: ASK_BRAND.indigo }}>
                {item.href === '/new-jersey'
                  ? 'Open New Jersey network research'
                  : item.href === '/california'
                    ? 'Open California network research'
                    : 'Open Place Lens'}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
