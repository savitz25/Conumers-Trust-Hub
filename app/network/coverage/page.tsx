import { CoverageAtlasView } from '@/components/coverage-atlas-view';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import type { Metadata } from 'next';

export const revalidate = 3600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string; state?: string; level?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Boolean(sp.hub || sp.state || sp.level);
  const base = createPageMetadata({
    title: 'Coverage Atlas — Where TrustHub has research',
    description:
      '50-state × six-hub capability matrix. Categorical coverage only — not a quality score.',
    path: '/network/coverage',
  });
  return {
    ...base,
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function CoverageAtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string; state?: string; level?: string }>;
}) {
  const { hub, state, level } = await searchParams;
  return (
    <>
      <PageHeader
        label="Coverage Atlas"
        title="Where TrustHub has research"
        description="Federal core, basic discovery, state research, enhanced state intelligence, enhanced county intelligence, or not yet researched. Not a numeric depth score."
      />
      <div className="container-page py-10 sm:py-14">
        <CoverageAtlasView hub={hub} state={state} level={level} />
      </div>
    </>
  );
}
