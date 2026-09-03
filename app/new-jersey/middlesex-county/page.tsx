import { NewJerseyCountyPage, njCountyMetadata } from '@/lib/network/nj-county-page';

export const metadata = njCountyMetadata('middlesex-county');

export default function Page() {
  return <NewJerseyCountyPage slug="middlesex-county" />;
}
