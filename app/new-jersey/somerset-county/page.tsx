import { NewJerseyCountyPage, njCountyMetadata } from '@/lib/network/nj-county-page';

export const metadata = njCountyMetadata('somerset-county');

export default function Page() {
  return <NewJerseyCountyPage slug="somerset-county" />;
}
