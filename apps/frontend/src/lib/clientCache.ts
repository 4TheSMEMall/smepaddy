type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

const prefix = "sme_paddy_cache";

export function makeCacheKey(token: string, scope: string, params = "") {
  return `${prefix}:${token.slice(-16)}:${scope}:${params}`;
}

export function readClientCache<T>(key: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function writeClientCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        value,
      } satisfies CacheEnvelope<T>),
    );
  } catch {
    // Storage can be full or blocked; the app should still work online.
  }
}

export function removeClientCache(keyPrefix: string) {
  if (typeof window === "undefined") return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(keyPrefix)) window.localStorage.removeItem(key);
  }
}
