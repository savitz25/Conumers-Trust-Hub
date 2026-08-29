import { NAME_IS_NOT_IDENTITY } from './vocabulary.ts';

/**
 * Future: Check a name across the TrustHub Network.
 * Prompt 1 documents the invariant only. No cross-system merge.
 */
export const CROSS_HUB_NAME_CHECK = {
  version: 'name-check-invariant-v1',
  invariant: NAME_IS_NOT_IDENTITY,
  resultLanguage: {
    nameAppearance: 'This display name appears in more than one hub or record.',
    confirmedMatch: 'Confirmed identity match requires shared regulatory identifiers, not similar names.',
  },
} as const;
