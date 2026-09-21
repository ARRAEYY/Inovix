/**
 * Distributed lock helper for cron jobs — prevents two backend instances
 * from running the same job concurrently in a multi-instance deploy.
 *
 * Strategy: Postgres transaction-scoped advisory locks.
 *   - pg_try_advisory_xact_lock(bigint) returns true if the lock was
 *     acquired, false if another session holds it. The lock is released
 *     automatically when the surrounding transaction commits / rolls back.
 *   - Job name is hashed to a 31-bit positive int (stays within Postgres
 *     bigint range AND JS Number.MAX_SAFE_INTEGER, so no BigInt marshalling
 *     issues across the wire).
 *
 * SQLite (dev) has no advisory locks; we fall back to running without a
 * lock. Dev is single-instance so this is fine — the lock would be a
 * no-op anyway. We detect SQLite by inspecting `DATABASE_URL` (file:...).
 *
 * Spec ref: §14 deployment notes — "in a multi-instance setup, only ONE
 * instance should run these jobs." This helper makes that an enforced
 * invariant instead of a documentation hint.
 */

const prisma = require('./prisma');
const crypto = require('crypto');

// Cache the provider detection so we don't re-evaluate on every cron tick.
let _isPostgres = null;

function isPostgres() {
  if (_isPostgres !== null) return _isPostgres;
  const url = process.env.DATABASE_URL || '';
  _isPostgres = url.startsWith('postgres') || url.startsWith('postgresql');
  return _isPostgres;
}

/**
 * Hash a job name to a 31-bit positive integer suitable for
 * pg_try_advisory_xact_lock. 31 bits = ~2B keys, more than enough for our
 * job-name space and the value fits in both JS Number.MAX_SAFE_INTEGER and
 * Postgres bigint positive range.
 */
function lockKeyFor(name) {
  const hash = crypto.createHash('sha1').update(name).digest();
  // Read first 4 bytes as unsigned 32-bit, mask off the top bit so the
  // result is always positive (Postgres bigint is signed 64-bit, but
  // passing a positive int avoids any ambiguity).
  return hash.readUInt32BE(0) & 0x7fffffff;
}

/**
 * Run `fn` while holding a transaction-scoped advisory lock named `lockName`.
 *
 * - On Postgres: opens a transaction, calls pg_try_advisory_xact_lock(key).
 *   If acquired, runs `fn(tx)` inside the transaction. If not acquired,
 *   returns { skipped: true } without calling fn.
 * - On SQLite (dev): calls `fn()` directly with no transaction wrapper.
 *   Dev is single-instance so the lock would be a no-op anyway.
 *
 * The fn receives the transaction client (tx) on Postgres so it can do
 * its DB work inside the lock-holding transaction. On SQLite, fn is
 * called with no argument — callers should use the global prisma client.
 *
 * Errors from fn propagate up; the transaction rolls back and the lock
 * is released.
 */
async function runWithAdvisoryLock(lockName, fn) {
  if (!isPostgres()) {
    // Dev / SQLite — single-instance assumption.
    return fn();
  }

  const key = lockKeyFor(lockName);

  return prisma.$transaction(async (tx) => {
    // Parameterized query — Prisma handles the int binding.
    const rows = await tx.$queryRaw`
      SELECT pg_try_advisory_xact_lock(${key}::bigint) AS acquired
    `;
    const acquired = rows && rows[0] && rows[0].acquired === true;
    if (!acquired) {
      return { skipped: true, lockName };
    }
    return fn(tx);
  });
}

module.exports = {
  runWithAdvisoryLock,
  lockKeyFor,
  isPostgres,
};
