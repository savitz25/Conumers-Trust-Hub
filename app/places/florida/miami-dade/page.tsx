import { PlaceLensView } from '@/components/place-lens-view';
import { PageHeader } from '@/components/page-header';
import { miamiDadePlaceLens } from '@/lib/network/place-lens';
import { createPageMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: 'Miami-Dade County Place Lens — What TrustHub knows',
  description:
    'ContractorTrustHub publishes Miami-Dade county credential intelligence. Other hubs remain state or federal. Not a county score.',
  path: '/places/florida/miami-dade',
});

export default function MiamiDadePlacePage() {
  const lens = miamiDadePlaceLens();
  return (
    <>
      <PageHeader label={lens.kicker} title={lens.title} description={lens.summary} />
      <div className="container-page py-10 sm:py-14">
        <PlaceLensView lens={lens} />
      </div>
    </>
  );
}
