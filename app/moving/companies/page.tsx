import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TrustBadge } from '@/components/trust-badge';
import { ZipSearchBar } from '@/components/zip-search-bar';
import { Button } from '@/components/ui/button';

export const metadata = createPageMetadata({
  title: 'FMCSA Verified Mover Directory',
  description: 'Browse FMCSA-licensed interstate movers with trust scores and attributed reviews.',
  path: '/moving/companies',
});

export default function MovingCompaniesPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <TrustBadge type="FMCSA" className="mb-4" />
      <h1 className="text-3xl font-bold">Mover Directory</h1>
      <p className="text-muted-foreground mt-2 max-w-xl">
        Full directory migrates from MoveTrust Hub at redirect activation. Search by ZIP to preview the experience.
      </p>
      <div className="mt-8 max-w-md"><ZipSearchBar defaultVertical="moving" showHubSwitcher={false} variant="compact" /></div>
      <Button variant="outline" className="mt-6 rounded-xl" asChild>
        <Link href="/moving">← Back to Moving Hub</Link>
      </Button>
    </div>
  );
}