import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { HubCard } from '@/components/hub-card';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BRAND } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';

export const metadata = createPageMetadata({
  title: 'About the Network',
  description:
    'Why ConsumerTrust Hub exists: independent consumer research infrastructure for moving, insurance, and lending—without paid placements.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <PageHeader
        label="About the network"
        title="A parent brand for independent consumer research"
        description={`${BRAND.name} is the trust infrastructure and discovery layer behind specialist Trust Hubs—not a content farm or mega-directory.`}
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <p>
            High-stakes consumer markets—moving, insurance, lending—are saturated with lead-gen
            sites that look like research tools. Rankings get sold. “Featured” means paid. Primary
            licensing data is buried under urgency tactics.
          </p>
          <p>
            {BRAND.name} was built as the opposite: a thin, serious parent network that sets
            independence standards, explains methodology, and points people to specialist hubs that
            do the deep work.
          </p>
          <h2>What this site is</h2>
          <ul>
            <li>Network positioning and discovery for the Trust Hubs</li>
            <li>Public promises on independence, methodology, and revenue</li>
            <li>Named accountability for who operates the project</li>
            <li>Shared design and schema foundation for the network</li>
          </ul>
          <h2>What this site is not</h2>
          <ul>
            <li>Not a provider directory</li>
            <li>Not a location-page content farm</li>
            <li>Not a blog competing with specialist hubs</li>
            <li>Not a lead-gen marketplace in parent clothing</li>
          </ul>
          <p>
            Specialist sites own market depth. This parent owns the promise that depth remains
            independent.
          </p>
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">The Trust Hubs</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {TRUST_HUBS.map((hub) => (
              <HubCard key={hub.id} hub={hub} />
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/who-we-are" className="btn-primary">
            Who we are
          </Link>
          <Link href="/promise" className="btn-secondary">
            Our promise
          </Link>
          <Link href="/contact" className="btn-secondary">
            Contact
          </Link>
        </div>
      </div>
    </>
  );
}
