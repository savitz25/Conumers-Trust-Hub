import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { INDEPENDENCE_PLEDGES } from '@/lib/content';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Our Promise — Independence & No Paid Placements',
  description:
    'ConsumerTrust Hub independence promise: zero paid placements, transparent methodology, and a clear separation between research and commerce.',
  path: '/promise',
});

export default function PromisePage() {
  return (
    <>
      <PageHeader
        label="Our promise"
        title="Independence is not optional."
        description="Zero paid placements. Transparent methodology. A research network that refuses to sell ranking position."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <p>
            {BRAND.name} exists because consumers deserve better than sponsored “top 10” lists that
            look like research. Our promise is simple: across this parent site and every Trust Hub,
            editorial trust signals are not for sale.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {INDEPENDENCE_PLEDGES.map((item) => (
            <article key={item.title} className="card-surface p-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>

        <section className="prose-trust mt-16">
          <h2>What “no paid placements” means in practice</h2>
          <ul>
            <li>Providers cannot buy higher rank, featured badges, or preferred sort order.</li>
            <li>Trust Scores and verification badges are not commercial products.</li>
            <li>Any future advertising or opt-in commercial tools will be labeled and isolated from organic research ordering.</li>
            <li>Corrections are based on public records and evidence—not on willingness to pay.</li>
          </ul>

          <h2>What we are not</h2>
          <p>
            We are not a moving company, mortgage broker, bank, insurance agency, or lead-only
            marketplace. We do not book moves, originate loans, or sell policies. Specialist hubs
            may offer optional consumer tools; those tools never rewrite independence rules.
          </p>

          <h2>How this is enforced</h2>
          <p>
            Network policy is documented on this parent site and applied by each Trust Hub. If you
            believe a placement or ranking was sold, contact us. We treat that as a serious integrity
            issue—not a marketing dispute.
          </p>

          <p className="mt-10 flex flex-wrap gap-4 not-prose">
            <Link href="/methodology" className="btn-primary">
              How we verify
            </Link>
            <Link href="/how-we-make-money" className="btn-secondary">
              How we make money
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
