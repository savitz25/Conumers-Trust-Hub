const listeners = new Set<(nativeProfileId: string) => void>();

export function registerPublicReadInvalidator(fn: (nativeProfileId: string) => void): void {
  listeners.add(fn);
}

export function invalidatePublicContractorRead(nativeProfileId: string): void {
  if (!nativeProfileId) return;
  for (const fn of listeners) {
    try {
      fn(nativeProfileId);
    } catch {
      // Invalidation must never break a mutation.
    }
  }
}
