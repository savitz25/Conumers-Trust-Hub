import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';

export const metadata = createPageMetadata({
  title: 'Insurance Calculators',
  description: 'ACA subsidy, Medicare gap, and premium estimator tools.',
  path: '/insurance/calculators',
});

export default function InsuranceCalculatorsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">🛡️ Insurance Calculators</h1>
      <p className="text-muted-foreground mt-2">Calculator suite migrates from InsuranceTrust Hub at redirect activation.</p>
      <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/insurance">← Back to Insurance Hub</Link></Button>
    </div>
  );
}