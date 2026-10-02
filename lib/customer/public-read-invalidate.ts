import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * What a publication-affecting write changed (ATH-CLAIM-V2-001R4):
 *  - granted : the profile ENTERED the public existence set (approval → active grant)
 *  - revoked : the profile LEFT it (revocation)
 *  - content : only its published payload changed (business-profile save/reconfirm, reply publish/withdraw)
 * Content writes never touch existence state; membership changes patch it incrementally.
 */
export type PublicReadChange = 'granted' | 'revoked' | 'content';
type Listener = (nativeProfileId: string, change: PublicReadChange) => void;

const listeners = new Set<Listener>();
const pendingScope = new AsyncLocalStorage<Map<string, Set<PublicReadChange>>>();

/** Shared (cross-instance) Next data-cache tags for the public contractor read path. */
export const PUBLIC_EXISTENCE_TAG = 'public-contractor-existence';
export const publicStateTag = (nativeProfileId: string) => `public-contractor-state:${nativeProfileId}`;

export function registerPublicReadInvalidator(fn: Listener): void {
  listeners.add(fn);
}

/**
 * Server-side only: called by store mutations (approval, business-profile save/reconfirm, reply publish/withdraw,
 * revocation). There is deliberately no route that lets a client trigger this.
 */
export function invalidatePublicContractorRead(nativeProfileId: string, change: PublicReadChange = 'content'): void {
  if (!nativeProfileId) return;
  const pending = pendingScope.getStore();
  if (pending) {
    const changes = pending.get(nativeProfileId) ?? new Set<PublicReadChange>();
    changes.add(change);
    pending.set(nativeProfileId, changes);
    return;
  }
  fire(nativeProfileId, change);
}

/**
 * Runs `fn` (a DB transaction) and fires the invalidations it requested only after it resolves, i.e. after COMMIT.
 * Invalidating before COMMIT would let a concurrent public read re-cache the pre-write state in the shared cache;
 * a rolled-back transaction (fn throws) invalidates nothing because nothing changed.
 */
export async function withDeferredPublicReadInvalidation<T>(fn: () => Promise<T>): Promise<T> {
  const pending = new Map<string, Set<PublicReadChange>>();
  const result = await pendingScope.run(pending, fn);
  for (const [id, changes] of pending) {
    // Within one transaction a membership change supersedes content; granted+revoked resolves to the last state
    // the DB holds, which a full existence refresh (either kind) reads correctly.
    const change: PublicReadChange = changes.has('revoked') ? 'revoked' : changes.has('granted') ? 'granted' : 'content';
    fire(id, change);
  }
  return result;
}

function fire(nativeProfileId: string, change: PublicReadChange): void {
  for (const fn of listeners) {
    try {
      fn(nativeProfileId, change);
    } catch {
      // Invalidation must never break a mutation.
    }
  }
}

export function publicReadInvalidatorCount(): number {
  return listeners.size;
}
