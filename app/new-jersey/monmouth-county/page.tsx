import { NewJerseyCountyPage, njCountyMetadata } from '@/lib/network/nj-county-page';

export const metadata = njCountyMetadata('monmouth-county');

export default function Page() {
  return <NewJerseyCountyPage slug="monmouth-county" />;
}
