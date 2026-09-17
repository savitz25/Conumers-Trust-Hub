import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { registerPublicReadInvalidator } from './public-read-invalidate';
import { withPlatform } from './server';
import {
  createPublicContractorReadLayer,
  emptyPublicContractorState,
  isPublicContractorId,
  PUBLIC_CACHE_CONTROL,
  type PublicContractorTrustState,
  type PublicReadSource,
} from './public-read-layer';

export { PUBLIC_CACHE_CONTROL, emptyPublicContractorState, isPublicContractorId };
export type { PublicContractorTrustState, PublicReadSource };

const EXISTENCE_TAG = 'public-contractor-existence';
const stateTag = (id: string) => `public-contractor-state:${id}`;

const cachedList = unstable_cache(
  async () => withPlatform((p) => p.listPublicContractorNativeIds()),
  ['public-contractor-existence-v1'],
  { revalidate: 21600, tags: [EXISTENCE_TAG] },
);

const layer = createPublicContractorReadLayer({
  listPublicIds: cachedList,
  loadPublishedState: async (id) =>
    withPlatform(async (p) => {
      const [profile, replies] = await Promise.all([p.publicBusinessProfile(id), p.publicBusinessReplies(id)]);
      return { profile, replies: replies.replies };
    }),
});

export async function readPublicContractorState(contractorId: string) {
  return layer.read(contractorId);
}

registerPublicReadInvalidator((nativeProfileId) => {
  layer.invalidate(nativeProfileId);
  try {
    revalidateTag(EXISTENCE_TAG, 'max');
    revalidateTag(stateTag(nativeProfileId), 'max');
  } catch {
    // Preview/tests without the Next cache runtime still clear memory.
  }
});

export function publicReadHeaders(source: PublicReadSource) {
  return {
    'Cache-Control': PUBLIC_CACHE_CONTROL,
    'X-Robots-Tag': 'noindex, nofollow',
    'X-ATH-Public-Read': source,
  };
}
