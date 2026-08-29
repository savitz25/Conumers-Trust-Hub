import { PlaceLensView } from '@/components/place-lens-view';
import { PageHeader } from '@/components/page-header';
import { palmBeachPlaceLens } from '@/lib/network/place-lens';
import { createPageMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: 'Palm Beach County Place Lens — What TrustHub knows',
  description:
    'Palm Beach Contractor Intelligence exists on the same mailing-county grain as Broward. Counts are not copied. Not a county score.',
  path: '/places/florida/palm-beach',
});

export default function PalmBeachPlacePage() {
  const lens = palmBeachPlaceLens();
  return (
    <>
      <PageHeader label={lens.kicker} title={lens.title} description={lens.summary} />
      <div className="container-page py-10 sm:py-14">
        <PlaceLensView lens={lens} />
      </div>
    </>
  );
}
