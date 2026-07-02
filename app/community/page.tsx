import Link from 'next/link';
import { Users, MapPin } from 'lucide-react';
import { createPageMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = createPageMetadata({
  title: 'Community',
  description: 'Geo-tagged moving questions and answers from families like yours. Launching V2.',
  path: '/community',
});

export default function CommunityPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <Users className="h-12 w-12 text-trust mx-auto mb-4" />
      <h1 className="text-3xl font-bold">Move Community</h1>
      <p className="text-muted-foreground mt-4">
        Ask geo-tagged questions, share tips, and learn from families who&apos;ve been there.
        Moderated, spam-free, actually helpful — launching V2.
      </p>

      <Card className="mt-10 text-left">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-trust" /> Preview thread
          </p>
          <p className="mt-2 font-medium">&quot;Best FMCSA movers for Denver → Austin?&quot;</p>
          <p className="text-sm text-muted-foreground mt-1">12 replies · Verified contributors only</p>
        </CardContent>
      </Card>

      <Button variant="trust" className="mt-8 rounded-xl" asChild>
        <Link href="/concierge">Ask the AI coach instead →</Link>
      </Button>
    </div>
  );
}