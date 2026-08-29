import { EvidenceAtlasView } from '@/components/evidence-atlas-view';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import type { Metadata } from 'next';

export const revalidate = 3600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string; family?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const base = createPageMetadata({
    title: 'Evidence Atlas — What each hub can show',
    description: 'Evidence families across six specialist hubs. Categorical status only.',
    path: '/network/evidence',
  });
  return {
    ...base,
    robots: sp.hub || sp.family ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function EvidenceAtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string; family?: string }>;
}) {
  const { hub, family } = await searchParams;
  return (
    <>
      <PageHeader
        label="Evidence Atlas"
        title="What each research system can show"
        description="Identity, licensing, ownership, market activity, and more — by hub. Not percentages. Not a quality heatmap."
      />
      <div className="container-page py-10 sm:py-14">
        <EvidenceAtlasView hub={hub} family={family} />
      </div>
    </>
  );
}
