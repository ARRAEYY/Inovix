/**
 * cache.js — optional Redis cache with graceful degradation.
 *
 * Driven entirely by REDIS_URL. If the var is unset, or the server is
 * unreachable (e.g. an internal hostname like db-test that only resolves
 * inside its own network), every cache call silently no-ops and callers
 * fall through to the database — the app behaves exactly as it did
 * without the cache. Nothing here may ever throw into a request path.
 *
 * Values are JSON-serialized. Keys should be namespaced per feature:
 *   notif:u:<userId>:...          — notifications (invalidated on write)
 *   catalog:outlets / catalog:... — catalog reads (short TTL, no invalidation)
 */

let Redis;
try {
  ({ Redis } = require('ioredis'));
} catch {
  Redis = null;
}

const TTL_DEFAULT_SECONDS = 60;

let client = null;
let state = process.env.REDIS_URL && Redis ? 'idle' : 'disabled'; // idle | connecting | up | down | disabled

function logState(next, detail) {
  if (state === next) return;
  state = next;
  if (next === 'down') console.warn(`[cache] Redis unavailable (${detail}) — serving from DB`);
  else if (next === 'up') console.log('[cache] Redis connected');
}

function getClient() {
  if (state === 'disabled' || !Redis) return null;
  if (client) return client;
  client = new Redis(process.env.REDIS_URL, {
    lazyConnect: true, // connect on first command, not at import time
    connectTimeout: 2000,
    maxRetriesPerRequest: 0, // fail commands fast instead of queueing while down
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      // Give up after a few quick attempts — a dead host must not spin.
      if (times > 3) return null;
      return Math.min(times * 500, 2000);
    },
  });
  client.on('ready', () => logState('up'));
  client.on('error', (err) => logState('down', err.code || err.message));
  client.on('end', () => logState('down', 'connection closed'));
  client.connect().catch(() => {}); // handled via 'error'/'end' events
  return client;
}

async function cacheGet(key) {
  const c = getClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = TTL_DEFAULT_SECONDS) {
  const c = getClient();
  if (!c) return false;
  try {
    await c.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

async function cacheDel(key) {
  const c = getClient();
  if (!c) return false;
  try {
    await c.del(key);
    return true;
  } catch {
    return false;
  }
}

// Delete every key matching `prefix*` via SCAN (safe for production Redis).
async function cacheDelPrefix(prefix) {
  const c = getClient();
  if (!c) return 0;
  let deleted = 0;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await c.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) {
        await c.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    return deleted;
  } catch {
    return deleted;
  }
}

/**
 * Read-through helper: returns the cached value when present, otherwise
 * calls loader(), stores the result for ttlSeconds, and returns it. If the
 * loader throws, the error propagates (cache never masks DB failures).
 */
async function cached(key, ttlSeconds, loader) {
  const hit = await cacheGet(key);
  if (hit !== null) return hit;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

function redisStatus() {
  return state;
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelPrefix, cached, redisStatus };
