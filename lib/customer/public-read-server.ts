import 'server-only';
import { unstable_cache } from 'next/cache';
import { PUBLIC_EXISTENCE_TAG, publicStateTag, registerPublicReadInvalidator } from './public-read-invalidate';
import { withPlatform } from './server';
import {
  createPublicContractorReadLayer,
  emptyPublicContractorState,
  isPublicContractorId,
  PUBLIC_CACHE_CONTROL,
  SHARED_REVALIDATE_S,
  type PublicContractorTrustState,
  type PublicReadSource,
} from './public-read-layer';

export { PUBLIC_CACHE_CONTROL, emptyPublicContractorState, isPublicContractorId };
export type { PublicContractorTrustState, PublicReadSource };

// Shared across instances; the Next tag invalidator registered in ./server expires these on every
// publication-affecting write. SHARED_REVALIDATE_S only bounds staleness if an invalidation is lost.
const cachedList = unstable_cache(
  async () => withPlatform((p) => p.listPublicContractorNativeIds()),
  ['public-contractor-existence-v2'],
  { revalidate: SHARED_REVALIDATE_S, tags: [PUBLIC_EXISTENCE_TAG] },
);

const cachedState = (id: string) =>
  unstable_cache(
    async () =>
      withPlatform(async (p) => {
        const [profile, replies] = await Promise.all([p.publicBusinessProfile(id), p.publicBusinessReplies(id)]);
        return { profile, replies: replies.replies };
      }),
    ['public-contractor-state-v2', id],
    { revalidate: SHARED_REVALIDATE_S, tags: [publicStateTag(id)] },
  )();

const layer = createPublicContractorReadLayer({
  listPublicIds: cachedList,
  loadPublishedState: cachedState,
});

export async function readPublicContractorState(contractorId: string) {
  return layer.read(contractorId);
}

// Same-instance memo clear. Other instances converge within EXISTENCE_TTL_MS via the shared cache.
registerPublicReadInvalidator((nativeProfileId) => layer.invalidate(nativeProfileId));

export function publicReadHeaders(source: PublicReadSource) {
  return {
    'Cache-Control': PUBLIC_CACHE_CONTROL,
    'X-Robots-Tag': 'noindex, nofollow',
    'X-ATH-Public-Read': source,
  };
}
