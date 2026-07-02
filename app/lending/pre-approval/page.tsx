import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = createPageMetadata({
  title: 'Mortgage Pre-Approval',
  description: 'Start your pre-approval with NMLS-verified lenders in your county.',
  path: '/lending/pre-approval',
});

export default function PreApprovalPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <h1 className="text-3xl font-bold">Get Pre-Approved</h1>
      <p className="text-muted-foreground mt-2">Sellers love a ready buyer — this takes about 15 minutes.</p>
      <Card className="mt-8 border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Pre-approval intake form loads here (V1)</CardContent></Card>
      <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/lending">← Back to Lending Hub</Link></Button>
    </div>
  );
}