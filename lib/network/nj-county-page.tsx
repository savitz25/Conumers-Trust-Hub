import { NewJerseyCountyGateway } from '@/components/new-jersey-county-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import { createPageMetadata } from '@/lib/seo/metadata';
import { njCountyBySlug, type NjPilotCountySlug } from '@/lib/network/nj-counties';
import { HUB_CARD_ORDER, HUB_CARD_TITLES, dedicatedCountyPage, njCountySpecialistUrl } from '@/lib/network/nj-counties';

export function njCountyMetadata(slug: NjPilotCountySlug) {
  const county = njCountyBySlug(slug);
  const name = county?.county ?? slug;
  return createPageMetadata({
    title: `${name} County Consumer Research`,
    description: `What the Trust Hub Network can research in ${name} County, New Jersey. Contractor and Lender county pages, plus state-level Insurance, Move, and Investor research. No paid placements. No Trust Score.`,
    path: `/new-jersey/${slug}`,
  });
}

export function NewJerseyCountyPage({ slug }: { slug: NjPilotCountySlug }) {
  const county = njCountyBySlug(slug);
  if (!county) return null;
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}/new-jersey/${slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `${county.county} County Consumer Research | Ask Trust Hub`,
        description:
          'Network county gateway. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'New Jersey', item: `${origin}/new-jersey` },
          { '@type': 'ListItem', position: 3, name: `${county.county} County`, item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${county.county} County specialist research options`,
        itemListElement: HUB_CARD_ORDER.map((hubId, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: dedicatedCountyPage(hubId, slug)
            ? `${HUB_CARD_TITLES[hubId]} ${county.county} County`
            : `${HUB_CARD_TITLES[hubId]} New Jersey`,
          url: njCountySpecialistUrl(hubId, slug),
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <NewJerseyCountyGateway county={county} />
    </>
  );
}
