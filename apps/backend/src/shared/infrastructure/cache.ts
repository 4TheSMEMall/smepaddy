type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

// Cap prevents unbounded memory growth from unique cursor/filter combinations.
const MAX_ENTRIES = 500;
const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>(
  key: string,
  ttlMs: number,
  loadFresh: () => Promise<T>,
): Promise<T> {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await loadFresh();

  if (memoryCache.size >= MAX_ENTRIES) {
    evictOldest(now);
  }

  memoryCache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

// First pass: remove expired entries (free wins). Second pass: drop the oldest
// inserted entry (Map preserves insertion order, so keys().next() = oldest).
function evictOldest(now: number) {
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
      if (memoryCache.size < MAX_ENTRIES) return;
    }
  }
  const firstKey = memoryCache.keys().next().value;
  if (firstKey !== undefined) memoryCache.delete(firstKey);
}

export function businessCacheKey(
  businessProfileId: string,
  scope: string,
  parts: Array<string | number | boolean | null | undefined> = [],
) {
  const suffix = parts
    .map((part) => encodeURIComponent(String(part ?? "")))
    .join(":");

  return suffix
    ? `business:${businessProfileId}:${scope}:${suffix}`
    : `business:${businessProfileId}:${scope}`;
}

export function invalidateBusinessCache(
  businessProfileId: string,
  scopes?: string[],
) {
  const prefixes = scopes?.length
    ? scopes.map((scope) => `business:${businessProfileId}:${scope}`)
    : [`business:${businessProfileId}:`];

  for (const key of memoryCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      memoryCache.delete(key);
    }
  }
}
