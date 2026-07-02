import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TrustBadge } from '@/components/trust-badge';
import { ZipSearchBar } from '@/components/zip-search-bar';
import { Button } from '@/components/ui/button';

export const metadata = createPageMetadata({
  title: 'NMLS Verified Local Lenders',
  description: 'Discover honest lenders in your county with NMLS verification and county experience scores.',
  path: '/lending/lenders',
});

export default function LendersPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <TrustBadge type="NMLS" className="mb-4" />
      <h1 className="text-3xl font-bold">Local Lender Directory</h1>
      <p className="text-muted-foreground mt-2 max-w-xl">County pages migrate from LenderTrust Hub at redirect activation.</p>
      <div className="mt-8 max-w-md"><ZipSearchBar defaultVertical="lending" showHubSwitcher={false} variant="compact" /></div>
      <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/lending">← Back to Lending Hub</Link></Button>
    </div>
  );
}