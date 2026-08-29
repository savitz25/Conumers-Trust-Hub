import { PlaceLensView } from '@/components/place-lens-view';
import { PageHeader } from '@/components/page-header';
import { floridaPlaceLens } from '@/lib/network/place-lens';
import { createPageMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: 'Florida Place Lens — What TrustHub can research in Florida',
  description:
    'Move, Lender, Insurance, Contractor, Senior, and Investor capabilities in Florida. Not a state score.',
  path: '/places/florida',
});

export default function FloridaPlacePage() {
  const lens = floridaPlaceLens();
  return (
    <>
      <PageHeader label={lens.kicker} title={lens.title} description={lens.summary} />
      <div className="container-page py-10 sm:py-14">
        <PlaceLensView lens={lens} />
      </div>
    </>
  );
}
