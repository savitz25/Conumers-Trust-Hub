/**
 * ASK-B1 — recently added network states for the homepage strip.
 *
 * Derived from the canonical catalog (new gateways are appended there) and each
 * state's accepted publication manifest. Highlights are the manifest's own
 * per-hub `capability_summary` strings: nothing here is authored, summed, or
 * re-counted. A state without that manifest field is skipped, not invented.
 */
import { listGatedAskStates } from './published-ask-states.ts';
import { KY_PUBLICATION_MANIFEST } from './ky-network.ts';
import { LA_PUBLICATION_MANIFEST } from './la-network.ts';
import { IN_PUBLICATION_MANIFEST } from './in-network.ts';
import { WI_PUBLICATION_MANIFEST } from './wi-network.ts';
import { MD_PUBLICATION_MANIFEST } from './md-network.ts';
import { CT_PUBLICATION_MANIFEST } from './ct-network.ts';
import { MI_PUBLICATION_MANIFEST } from './mi-network.ts';
import { MN_PUBLICATION_MANIFEST } from './mn-network.ts';

type ManifestWithHubs = { hubs?: ReadonlyArray<{ hub_id?: string; capability_summary?: string }> };

const MANIFEST_BY_SLUG: Record<string, ManifestWithHubs> = {
  kentucky: KY_PUBLICATION_MANIFEST,
  louisiana: LA_PUBLICATION_MANIFEST,
  indiana: IN_PUBLICATION_MANIFEST,
  wisconsin: WI_PUBLICATION_MANIFEST,
  maryland: MD_PUBLICATION_MANIFEST,
  connecticut: CT_PUBLICATION_MANIFEST,
  michigan: MI_PUBLICATION_MANIFEST,
  minnesota: MN_PUBLICATION_MANIFEST,
};

export type RecentAskState = {
  code: string;
  slug: string;
  name: string;
  href: string;
  highlights: Array<{ hub: string; summary: string }>;
};

export function listRecentAskStates(limit = 4, highlightsPerState = 3): RecentAskState[] {
  const recent: RecentAskState[] = [];
  for (const state of listGatedAskStates().reverse()) {
    if (recent.length >= limit) break;
    const hubs = (MANIFEST_BY_SLUG[state.slug]?.hubs ?? []).flatMap((hub) =>
      typeof hub.hub_id === 'string' && typeof hub.capability_summary === 'string' && hub.capability_summary.trim()
        ? [{ hub: hub.hub_id, summary: hub.capability_summary.trim() }]
        : [],
    );
    if (hubs.length === 0) continue;
    // Prefer summaries that lead with a source-native count; fall back to manifest order.
    const counted = hubs.filter((hub) => /^\d/.test(hub.summary));
    const ordered = [...counted, ...hubs.filter((hub) => !counted.includes(hub))];
    recent.push({ ...state, highlights: ordered.slice(0, highlightsPerState) });
  }
  return recent;
}
