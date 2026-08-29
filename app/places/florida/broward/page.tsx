import { PlaceLensView } from '@/components/place-lens-view';
import { PageHeader } from '@/components/page-header';
import { browardPlaceLens } from '@/lib/network/place-lens';
import { createPageMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: 'Broward County Place Lens — What TrustHub knows',
  description:
    'ContractorTrustHub publishes Broward county credential intelligence. Other hubs remain state or federal. Not a county score.',
  path: '/places/florida/broward',
});

export default function BrowardPlacePage() {
  const lens = browardPlaceLens();
  return (
    <>
      <PageHeader label={lens.kicker} title={lens.title} description={lens.summary} />
      <div className="container-page py-10 sm:py-14">
        <PlaceLensView lens={lens} />
      </div>
    </>
  );
}
