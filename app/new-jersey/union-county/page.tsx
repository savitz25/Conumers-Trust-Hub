import { NewJerseyCountyPage, njCountyMetadata } from '@/lib/network/nj-county-page';

export const metadata = njCountyMetadata('union-county');

export default function Page() {
  return <NewJerseyCountyPage slug="union-county" />;
}
