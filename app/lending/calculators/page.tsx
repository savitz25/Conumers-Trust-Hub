import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';

export const metadata = createPageMetadata({
  title: 'Mortgage Calculators',
  description: 'Payment, affordability, refinance, and amortization calculators.',
  path: '/lending/calculators',
});

export default function LendingCalculatorsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">🏡 Mortgage Calculators</h1>
      <p className="text-muted-foreground mt-2">Calculator suite migrates from LenderTrust Hub at redirect activation.</p>
      <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/lending">← Back to Lending Hub</Link></Button>
    </div>
  );
}