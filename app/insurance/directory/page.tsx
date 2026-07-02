import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TrustBadge } from '@/components/trust-badge';
import { ZipSearchBar } from '@/components/zip-search-bar';
import { Button } from '@/components/ui/button';

export const metadata = createPageMetadata({
  title: 'DOI Verified Insurance Agents',
  description: 'Browse state-licensed insurance agents and agencies nationwide.',
  path: '/insurance/directory',
});

export default function InsuranceDirectoryPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <TrustBadge type="DOI" className="mb-4" />
      <h1 className="text-3xl font-bold">Agent & Agency Directory</h1>
      <p className="text-muted-foreground mt-2 max-w-xl">Full directory migrates from InsuranceTrust Hub at redirect activation.</p>
      <div className="mt-8 max-w-md"><ZipSearchBar defaultVertical="insurance" showHubSwitcher={false} variant="compact" /></div>
      <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/insurance">← Back to Insurance Hub</Link></Button>
    </div>
  );
}