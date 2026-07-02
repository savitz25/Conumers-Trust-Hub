import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = createPageMetadata({
  title: 'Moving Cost Calculator',
  description: 'Estimate cubic feet, weight, and truck size with our room-by-room inventory tool.',
  path: '/moving/calculator',
});

export default function MovingCalculatorPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold">📦 Smart Move Estimator</h1>
      <p className="text-muted-foreground mt-2">Calculator UI migrates at redirect activation. Stub ready for integration.</p>
      <Card className="mt-8 border-dashed">
        <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
          Interactive inventory builder loads here
        </CardContent>
      </Card>
      <Button variant="outline" className="mt-6 rounded-xl" asChild>
        <Link href="/moving">← Back to Moving Hub</Link>
      </Button>
    </div>
  );
}