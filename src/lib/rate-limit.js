/**
 * Lightweight in-memory sliding-window rate limiter for login, PIN, and override endpoints.
 */

const buckets = globalThis.__labosRateLimit || (globalThis.__labosRateLimit = new Map());

export function checkRateLimit(key, { maxAttempts = 10, windowMs = 10 * 60_000 } = {}) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (hits.length >= maxAttempts) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    buckets.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  return { allowed: true, remaining: maxAttempts - hits.length, retryAfterSec: 0 };
}

export function recordRateFailure(key, windowMs = 10 * 60_000) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
  hits.push(now);
  if (buckets.size > 5000) buckets.clear();
  buckets.set(key, hits);
}

export function clearRateLimit(key) {
  buckets.delete(key);
}
