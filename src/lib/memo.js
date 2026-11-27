/**
 * Tiny in-memory TTL cache (per server process).
 * Concurrent callers share the same in-flight promise.
 */

const store = globalThis.__labosMemo || (globalThis.__labosMemo = new Map());

const MAX_ENTRIES = 1000;

// Monotonic clock: suitable for measuring cache TTL.
function getTime() {
  return performance.now();
}

export async function memo(key, ttlMs, fn) {
  const now = getTime();

  const hit = store.get(key);

  if (hit && hit.exp > now) {
    return hit.value;
  }

  if (hit) {
    store.delete(key);
  }

  if (store.size >= MAX_ENTRIES) {
    for (const [k, v] of store) {
      if (v.exp <= now) {
        store.delete(k);
      }
    }

    if (store.size >= MAX_ENTRIES) {
      store.clear();
    }
  }

  const value = Promise.resolve().then(fn);

  store.set(key, {
    exp: now + ttlMs,
    value,
  });

  try {
    return await value;
  } catch (error) {
    store.delete(key);
    throw error;
  }
}

export function memoDelete(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function memoClear() {
  store.clear();
}

export function invalidateStatsCache() {
  memoDelete("stats:");
  memoDelete("pharmacy:");
}
