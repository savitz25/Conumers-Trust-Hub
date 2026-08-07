import Link from 'next/link';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildBreadcrumbSchema } from '@/lib/seo/schemas';

export type Crumb = { name: string; path: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <JsonLd data={buildBreadcrumbSchema(items)} />
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.path} className="inline-flex items-center gap-1.5">
                {i > 0 ? (
                  <span style={{ color: ASK_BRAND.onNavyMuted }} aria-hidden>
                    /
                  </span>
                ) : null}
                {last ? (
                  <span className="font-medium" style={{ color: ASK_BRAND.navy }} aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.path}
                    className="font-medium underline-offset-4 hover:underline"
                    style={{ color: ASK_BRAND.indigo }}
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
