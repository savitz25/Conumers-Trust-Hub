/**
 * ASK-B1 — recently added network states for the homepage strip.
 *
 * Derived from the canonical catalog (new gateways are appended there) and each
 * state's accepted publication manifest. Highlights are the manifest's own
 * per-hub `capability_summary` strings: nothing here is authored, summed, or
 * re-counted. A state without that manifest field is skipped, not invented.
 */
import { listGatedAskStates } from './published-ask-states.ts';
import { MS_PUBLICATION_MANIFEST } from './ms-network.ts';
import { MO_PUBLICATION_MANIFEST } from './mo-network.ts';
import { OK_PUBLICATION_MANIFEST } from './ok-network.ts';
import { AR_PUBLICATION_MANIFEST } from './ar-network.ts';
import { UT_PUBLICATION_MANIFEST } from './ut-network.ts';
import { NM_PUBLICATION_MANIFEST } from './nm-network.ts';
import { IA_PUBLICATION_MANIFEST } from './ia-network.ts';
import { NE_PUBLICATION_MANIFEST } from './ne-network.ts';
import { KS_PUBLICATION_MANIFEST } from './ks-network.ts';
import { ID_PUBLICATION_MANIFEST } from './id-network.ts';
import { WV_PUBLICATION_MANIFEST } from './wv-network.ts';
import { SC_PUBLICATION_MANIFEST } from './sc-network.ts';
import { AL_PUBLICATION_MANIFEST } from './al-network.ts';
import { KY_PUBLICATION_MANIFEST } from './ky-network.ts';
import { LA_PUBLICATION_MANIFEST } from './la-network.ts';
import { IN_PUBLICATION_MANIFEST } from './in-network.ts';
import { WI_PUBLICATION_MANIFEST } from './wi-network.ts';
import { MD_PUBLICATION_MANIFEST } from './md-network.ts';
import { CT_PUBLICATION_MANIFEST } from './ct-network.ts';
import { MI_PUBLICATION_MANIFEST } from './mi-network.ts';
import { MN_PUBLICATION_MANIFEST } from './mn-network.ts';

type ManifestWithHubs = { hubs?: ReadonlyArray<{ hub_id?: string; capability_summary?: string; summary?: string }> };

const MANIFEST_BY_SLUG: Record<string, ManifestWithHubs> = {
  'west-virginia': WV_PUBLICATION_MANIFEST,
  idaho: ID_PUBLICATION_MANIFEST,
  nebraska: NE_PUBLICATION_MANIFEST,
  kansas: KS_PUBLICATION_MANIFEST,
  iowa: IA_PUBLICATION_MANIFEST,
  arkansas: AR_PUBLICATION_MANIFEST,
  utah: UT_PUBLICATION_MANIFEST,
  'new-mexico': NM_PUBLICATION_MANIFEST,
  oklahoma: OK_PUBLICATION_MANIFEST,
  missouri: MO_PUBLICATION_MANIFEST,
  mississippi: MS_PUBLICATION_MANIFEST,
  'south-carolina': SC_PUBLICATION_MANIFEST,
  alabama: AL_PUBLICATION_MANIFEST,
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
      typeof hub.hub_id === 'string' && typeof (hub.capability_summary ?? hub.summary) === 'string' && (hub.capability_summary ?? hub.summary)?.trim()
        ? [{ hub: hub.hub_id, summary: (hub.capability_summary ?? hub.summary)!.trim() }]
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
