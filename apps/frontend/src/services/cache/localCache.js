// localCache — tiny localStorage cache with expiry (stale-while-revalidate).
//
// Used to render instantly from the last-known data and refresh in the
// background, so screens don't wait on the network on every visit. Always
// key per user (e.g. `notif:${user.id}:unread`) — entries from another
// account must never leak into the UI.

const PREFIX = 'nosh:cache:';

export function cacheGet(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.t !== 'number') return null;
    if (maxAgeMs && Date.now() - entry.t > maxAgeMs) return null; // expired
    return entry.v;
  } catch {
    return null;
  }
}

/**
 * Returns cached data immediately regardless of expiry for instant UI rendering (SWR).
 * @param {string} key
 * @param {number} freshDurationMs - duration after which data is considered stale and revalidation is needed
 * @returns {{ data: any, isStale: boolean, timestamp: number | null }}
 */
export function cacheGetStale(key, freshDurationMs = 15 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return { data: null, isStale: true, timestamp: null };
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.t !== 'number') return { data: null, isStale: true, timestamp: null };
    const isStale = Date.now() - entry.t > freshDurationMs;
    return { data: entry.v, isStale, timestamp: entry.t };
  } catch {
    return { data: null, isStale: true, timestamp: null };
  }
}

export function cacheSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now() }));
  } catch {
    // storage full / disabled — caching is best-effort
  }
}

export function cacheRemove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

// Remove every entry whose key starts with `prefix` (e.g. on logout).
export function cacheClearPrefix(prefix) {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + prefix)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
