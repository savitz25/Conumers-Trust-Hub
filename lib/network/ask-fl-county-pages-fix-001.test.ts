import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  browardPlaceLens,
  miamiDadePlaceLens,
  palmBeachPlaceLens,
  pinellasPlaceLens,
  placeLensBySlug,
} from './place-lens.ts';

const FL_COUNTY_PATHS = [
  '/places/florida/miami-dade',
  '/places/florida/broward',
  '/places/florida/palm-beach',
  '/places/florida/pinellas',
] as const;

test('miami-dade and pinellas resolve to indexable county lenses', () => {
  for (const slug of ['miami-dade', 'pinellas'] as const) {
    const lens = placeLensBySlug(slug);
    assert.ok(lens, slug);
    assert.equal(lens.geographyType, 'county');
    assert.equal(lens.stateCode, 'FL');
    assert.equal(lens.countySlug, slug);
    assert.equal(lens.indexable, true);
    assert.equal(lens.hubs.length, 6);
    assert.equal(lens.hubs.find((hub) => hub.hubId === 'contractor')?.capability, 'enhanced_county_intelligence');
    assert.equal(lens.hubs.find((hub) => hub.hubId === 'lender')?.metrics.length, 0);
  }

  assert.equal(placeLensBySlug('dade'), undefined);
  assert.equal(placeLensBySlug('miami dade'), undefined);
  assert.equal(miamiDadePlaceLens().slug, 'miami-dade');
  assert.equal(pinellasPlaceLens().slug, 'pinellas');
});

test('county credential figures stay on the specialist mailing-county grain', () => {
  const miami = miamiDadePlaceLens().hubs.find((hub) => hub.hubId === 'contractor');
  const pinellas = pinellasPlaceLens().hubs.find((hub) => hub.hubId === 'contractor');
  assert.equal(miami?.metrics.find((metric) => /mailing\/base county/.test(metric.label))?.value, '18,369');
  assert.equal(miami?.metrics.find((metric) => metric.label === 'Active credentials, same county grain')?.value, '14,817');
  assert.equal(miami?.metrics.find((metric) => /roofing/i.test(metric.label))?.value, '1,156');
  assert.equal(miami?.destination, 'https://www.contractortrusthub.com/florida/miami-dade');
  assert.match(miami?.geographyMeaning ?? '', /county_code 23/);

  assert.equal(pinellas?.metrics.find((metric) => /mailing\/base county/.test(metric.label))?.value, '7,249');
  assert.equal(pinellas?.metrics.find((metric) => metric.label === 'Active credentials, same county grain')?.value, '5,539');
  assert.equal(pinellas?.metrics.find((metric) => /roofing/i.test(metric.label))?.value, '343');
  assert.equal(pinellas?.destination, 'https://www.contractortrusthub.com/florida/pinellas');
  assert.match(pinellas?.geographyMeaning ?? '', /county_code 62/);

  assert.equal(browardPlaceLens().hubs.find((hub) => hub.hubId === 'contractor')?.metrics.find((metric) => /roofing/i.test(metric.label))?.value, '924');
  assert.equal(palmBeachPlaceLens().hubs.find((hub) => hub.hubId === 'contractor')?.metrics.find((metric) => /roofing/i.test(metric.label)), undefined);
});

test('sitemap adds the two Florida counties and leaves other state entries on the catalog helper', () => {
  const sitemap = readFileSync('app/sitemap.ts', 'utf8');
  for (const path of FL_COUNTY_PATHS) {
    assert.match(sitemap, new RegExp(path.replaceAll('/', '\\/')));
  }
  assert.match(sitemap, /askStateSitemapEntries\(\)/);
  assert.match(sitemap, /listNjPilotCounties\(\)/);
  assert.doesNotMatch(sitemap, /\/places\/florida\/hillsborough/);
  assert.doesNotMatch(sitemap, /\/illinois\/chicago/);
});

test('county pages use a self-canonical indexable metadata path', () => {
  for (const slug of ['miami-dade', 'pinellas'] as const) {
    const page = readFileSync(`app/places/florida/${slug}/page.tsx`, 'utf8');
    assert.match(page, /createPageMetadata/);
    assert.match(page, new RegExp(`path: '/places/florida/${slug}'`));
    assert.doesNotMatch(page, /noIndex:\s*true/);
  }
});

test('404 metadata clears the homepage canonical and does not add a second index robots tag', () => {
  const notFound = readFileSync('app/not-found.tsx', 'utf8');
  const rootMetadata = readFileSync('lib/seo/metadata.ts', 'utf8');
  assert.match(notFound, /canonical:\s*null/);
  assert.doesNotMatch(notFound, /index:\s*true/);
  assert.doesNotMatch(notFound, /name=["']robots["']/);
  const rootBlock = rootMetadata.slice(rootMetadata.indexOf('export const rootLayoutMetadata'), rootMetadata.indexOf('export function createPageMetadata'));
  assert.doesNotMatch(rootBlock, /robots:/);
  assert.match(rootMetadata, /robots: noIndex/);
});
