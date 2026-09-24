/**
 * TH-HOMEPAGE-SYNC-001 — canonical Ask published-state catalog.
 *
 * Adding an accepted Ask state gateway means adding ONE entry here (plus the
 * specialist network module/page/manifest). Homepage explorer, Places, footer,
 * sitemap, and mixed-case slugs must derive from this catalog. Do not add a
 * second slug list in those surfaces.
 */
import { njReleaseGatePassed } from './nj-network.ts';
import { caReleaseGatePassed } from './ca-network.ts';
import { txReleaseGatePassed } from './tx-network.ts';
import { waReleaseGatePassed } from './wa-network.ts';
import { azReleaseGatePassed } from './az-network.ts';
import { coReleaseGatePassed } from './co-network.ts';
import { vaReleaseGatePassed } from './va-network.ts';
import { nyReleaseGatePassed } from './ny-network.ts';
import { ilReleaseGatePassed } from './il-network.ts';
import { orReleaseGatePassed } from './or-network.ts';
import { paReleaseGatePassed } from './pa-network.ts';
import { ncReleaseGatePassed } from './nc-network.ts';
import { ohReleaseGatePassed } from './oh-network.ts';
import { gaReleaseGatePassed } from './ga-network.ts';

export type AskPublishedState = {
  code: string;
  slug: string;
  name: string;
  gate: () => boolean;
};

export const ASK_PUBLISHED_STATE_CATALOG: readonly AskPublishedState[] = [
  { code: 'FL', slug: 'florida', name: 'Florida', gate: () => true },
  { code: 'NJ', slug: 'new-jersey', name: 'New Jersey', gate: njReleaseGatePassed },
  { code: 'CA', slug: 'california', name: 'California', gate: caReleaseGatePassed },
  { code: 'TX', slug: 'texas', name: 'Texas', gate: txReleaseGatePassed },
  { code: 'WA', slug: 'washington', name: 'Washington', gate: waReleaseGatePassed },
  { code: 'AZ', slug: 'arizona', name: 'Arizona', gate: azReleaseGatePassed },
  { code: 'CO', slug: 'colorado', name: 'Colorado', gate: coReleaseGatePassed },
  { code: 'VA', slug: 'virginia', name: 'Virginia', gate: vaReleaseGatePassed },
  { code: 'NY', slug: 'new-york', name: 'New York', gate: nyReleaseGatePassed },
  { code: 'IL', slug: 'illinois', name: 'Illinois', gate: ilReleaseGatePassed },
  { code: 'OR', slug: 'oregon', name: 'Oregon', gate: orReleaseGatePassed },
  { code: 'PA', slug: 'pennsylvania', name: 'Pennsylvania', gate: paReleaseGatePassed },
  { code: 'NC', slug: 'north-carolina', name: 'North Carolina', gate: ncReleaseGatePassed },
  { code: 'OH', slug: 'ohio', name: 'Ohio', gate: ohReleaseGatePassed },
  { code: 'GA', slug: 'georgia', name: 'Georgia', gate: gaReleaseGatePassed },
];

export function listAskNetworkStates(): Array<{ code: string; slug: string; name: string }> {
  return ASK_PUBLISHED_STATE_CATALOG.map(({ code, slug, name }) => ({ code, slug, name }));
}

export function listGatedAskStates(): Array<{ code: string; slug: string; name: string; href: string }> {
  return ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.gate()).map((state) => ({
    code: state.code,
    slug: state.slug,
    name: state.name,
    href: `/${state.slug}`,
  }));
}

export function askPublishedStatewideSlugs(): string[] {
  return ASK_PUBLISHED_STATE_CATALOG.map((state) => state.slug);
}

export function askStateExplorerEyebrow(): string {
  const n = ASK_PUBLISHED_STATE_CATALOG.length;
  const words = [
    'Zero',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
    'Twenty',
  ];
  const label = n < words.length ? words[n] : String(n);
  return `${label}-state network explorer`;
}

export function askStateFooterLinks(): Array<{ href: string; label: string }> {
  return listGatedAskStates()
    .filter((state) => state.slug !== 'florida')
    .map((state) => ({ href: state.href, label: `${state.name} research` }));
}

export function askStateSitemapEntries(lastmod = '2026-09-18'): Array<{
  path: string;
  priority: number;
  changeFrequency: 'weekly';
  lastmod: string;
}> {
  return listGatedAskStates()
    .filter((state) => state.slug !== 'florida')
    .map((state) => ({
      path: state.href,
      priority: 0.85,
      changeFrequency: 'weekly' as const,
      lastmod,
    }));
}

export function askStatePlaceEntries(): Array<{ href: string; label: string; detail: string }> {
  return listGatedAskStates()
    .filter((state) => state.slug !== 'florida')
    .map((state) => ({
      href: state.href,
      label: state.name,
      detail: `Network gateway to specialist ${state.name} research pages. State-level only — not a city or county page.`,
    }));
}
