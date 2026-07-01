import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { createPageMetadata } from '@/lib/seo/metadata';
import { ARTICLES } from '@/lib/resources/articles';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = createPageMetadata({
  title: 'Resources & Guides',
  description:
    'Integrative guides connecting moving, lending, and insurance decisions. Complete move package checklists and cross-category research.',
  path: '/resources',
});

const CATEGORY_LABELS = {
  moving: 'Moving',
  lending: 'Lending',
  insurance: 'Insurance',
  'cross-category': 'Cross-Category',
} as const;

export default function ResourcesPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">Resources & Guides</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Integrative articles helping you coordinate moving, mortgage, and insurance decisions
          in one research flow.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {ARTICLES.map((article) => (
          <Link key={article.slug} href={`/resources/${article.slug}`}>
            <Card className="h-full transition-shadow hover:shadow-trust-lg">
              <CardContent className="pt-6">
                <Badge
                  variant={article.category === 'cross-category' ? 'trust' : 'secondary'}
                  className="mb-3"
                >
                  {CATEGORY_LABELS[article.category]}
                </Badge>
                <h2 className="text-lg font-semibold leading-snug">{article.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>
                <p className="mt-4 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    {article.readTime}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-trust">
                    Read guide <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}