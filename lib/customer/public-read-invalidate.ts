import { AsyncLocalStorage } from 'node:async_hooks';

const listeners = new Set<(nativeProfileId: string) => void>();
const pendingScope = new AsyncLocalStorage<Set<string>>();

/** Shared (cross-instance) Next data-cache tags for the public contractor read path. */
export const PUBLIC_EXISTENCE_TAG = 'public-contractor-existence';
export const publicStateTag = (nativeProfileId: string) => `public-contractor-state:${nativeProfileId}`;

export function registerPublicReadInvalidator(fn: (nativeProfileId: string) => void): void {
  listeners.add(fn);
}

/**
 * Server-side only: called by store mutations (approval, business-profile save/reconfirm, reply publish/withdraw,
 * revocation). There is deliberately no route that lets a client trigger this.
 */
export function invalidatePublicContractorRead(nativeProfileId: string): void {
  if (!nativeProfileId) return;
  const pending = pendingScope.getStore();
  if (pending) {
    pending.add(nativeProfileId);
    return;
  }
  fire(nativeProfileId);
}

/**
 * Runs `fn` (a DB transaction) and fires the invalidations it requested only after it resolves, i.e. after COMMIT.
 * Invalidating before COMMIT would let a concurrent public read re-cache the pre-write state in the shared cache;
 * a rolled-back transaction (fn throws) invalidates nothing because nothing changed.
 */
export async function withDeferredPublicReadInvalidation<T>(fn: () => Promise<T>): Promise<T> {
  const ids = new Set<string>();
  const result = await pendingScope.run(ids, fn);
  for (const id of ids) fire(id);
  return result;
}

function fire(nativeProfileId: string): void {
  for (const fn of listeners) {
    try {
      fn(nativeProfileId);
    } catch {
      // Invalidation must never break a mutation.
    }
  }
}

export function publicReadInvalidatorCount(): number {
  return listeners.size;
}
