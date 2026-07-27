import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { DATA_SOURCES } from '@/lib/content';

export const metadata = createPageMetadata({
  title: 'Data Sources',
  description:
    'Primary data sources used across the ConsumerTrust Hub network: FMCSA, DOI/NAIC, NMLS, CFPB, and attributed reviews.',
  path: '/data-sources',
});

export default function DataSourcesPage() {
  return (
    <>
      <PageHeader
        label="Data sources"
        title="Primary sources we rely on"
        description="Licensing registries and public records first. Marketing claims last—if at all."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <p>
            Each Trust Hub is only as good as its sources. Below are the primary public datasets and
            registries the network uses. Specialist hubs may cite additional market-specific sources
            on-page.
          </p>
        </div>

        <ul className="mt-10 space-y-4">
          {DATA_SOURCES.map((source) => (
            <li key={source.name} className="card-surface p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {source.name}
                </h2>
                <p className="text-xs font-medium text-muted-foreground sm:text-right">
                  {source.hubs.join(' · ')}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {source.description}
              </p>
            </li>
          ))}
        </ul>

        <div className="prose-trust mt-14">
          <h2>Re-verify yourself</h2>
          <p>
            We compile and interpret public information. We do not replace official registries.
            Before hiring a mover, buying a policy, or signing a loan, confirm current licensing and
            terms directly with the relevant regulator and provider.
          </p>
          <p className="mt-8 flex flex-wrap gap-4 not-prose">
            <Link href="/methodology" className="btn-primary">
              Methodology
            </Link>
            <Link href="/promise" className="btn-secondary">
              Independence promise
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
