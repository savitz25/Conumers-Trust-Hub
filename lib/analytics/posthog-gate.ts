/**
 * Concurrency-safe singleton loader.
 * Callers during initialization await the same in-flight promise.
 * They must not receive null merely because load() has not finished.
 */
export function createPosthogClientGate<T>(load: () => Promise<T | null>) {
  let client: T | null = null;
  let inflight: Promise<T | null> | null = null;
  let startCount = 0;

  async function get(): Promise<T | null> {
    if (client) return client;
    if (inflight) return inflight;
    startCount += 1;
    inflight = Promise.resolve()
      .then(load)
      .then((instance) => {
        client = instance ?? null;
        if (!client) inflight = null;
        return client;
      })
      .catch(() => {
        client = null;
        inflight = null;
        return null;
      });
    return inflight;
  }

  function reset(): void {
    client = null;
    inflight = null;
  }

  return {
    get,
    reset,
    getStartCount: () => startCount,
  };
}

/** Previous ATH-OBS-001 race: concurrent callers received null while init was in flight. */
export async function getClientWithInitializingFlagRace<T>(
  state: { client: T | null; initializing: boolean },
  load: () => Promise<T | null>,
): Promise<T | null> {
  if (state.client) return state.client;
  if (state.initializing) return state.client;
  state.initializing = true;
  try {
    state.client = await load();
    return state.client;
  } catch {
    state.client = null;
    return null;
  } finally {
    state.initializing = false;
  }
}
