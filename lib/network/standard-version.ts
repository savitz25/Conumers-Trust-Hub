/**
 * Ask Trust Hub network contract version.
 * Keep in lockstep with docs/ASK-NETWORK-CONTRACT.md and lib/network/registry.ts.
 */
import { ASK_NETWORK_CONTRACT_VERSION } from '@/lib/network/registry';

export const ASK_NETWORK_STANDARD_VERSION = ASK_NETWORK_CONTRACT_VERSION;
export const ASK_NETWORK_STANDARD_URL = 'https://www.asktrusthub.com/methodology';

export const ASK_NETWORK_STANDARD_LABEL = 'Ask Trust Hub Standard';
export const ASK_NETWORK_STANDARD_LABEL_LONG =
  'Researched to the Ask Trust Hub Standard';
export const ASK_NETWORK_STANDARD_TOOLTIP =
  'Shared research standard for the Ask Trust Hub network';

/** Canonical short ownership / independence line (use everywhere). */
export const ASK_NETWORK_OWNERSHIP_SHORT =
  'Common ownership · Separated research and listing order · No paid placements';

/** Longer ownership sentence for prose blocks. */
export const ASK_NETWORK_OWNERSHIP_LINE =
  'Move, Lender, Insurance, Contractor, Senior, and Investor Trust Hub are part of the Ask Trust Hub network under common ownership, with separated research and listing order and no paid placements.';
