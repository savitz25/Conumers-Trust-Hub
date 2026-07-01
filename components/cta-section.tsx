import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnifiedSearch } from '@/components/unified-search';

export function CtaSection() {
  return (
    <section className="border-t bg-gradient-to-br from-primary via-primary to-trust/80 py-16 text-primary-foreground md:py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Ready to Shop with Confidence?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
          Start with a ZIP search or explore any vertical. All three sister sites are fully
          operational — we just make it easier to find them.
        </p>

        <div className="mx-auto mt-8 max-w-lg rounded-xl bg-background p-4 text-foreground shadow-trust-lg">
          <UnifiedSearch />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" variant="secondary" asChild className="gap-2">
            <Link href="/moving">
              Explore Movers <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
            <Link href="/about">Learn About Our Independence</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}