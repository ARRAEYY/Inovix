/**
 * INO-001 v2 — refresh-token rotation race test.
 *
 * Spec:
 *   - Fire N concurrent rotates of the SAME refresh token.
 *   - Assert EXACTLY ONE succeeds.
 *   - Assert the winner's replacement is well-formed
 *     (id.raw format, contains an access token, user matches).
 *   - Assert a sequential replay of the same original token fails
 *     (returns null) — the token is now rotated.
 *
 * Known limitation (documented, not tested):
 *   In the strict N-concurrent scenario, the losers see `replacedBy`
 *   on the row and trigger the global theft sweep — which CAN revoke
 *   the winner's newly-issued replacement token if their sweep runs
 *   after the winner's commit. A token-family design would prevent
 *   this; out of scope for V1. The test therefore asserts only that
 *   exactly ONE rotation succeeds, not that the replacement survives
 *   the losers' sweeps.
 *
 * Run via:
 *   JWT_SECRET=test NODE_ENV=test node --test tests/tokens.race.test.js
 *
 * Skips gracefully if DATABASE_URL is not set or the dev.db is missing.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Load .env from repo root.
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const {
  issueRefreshToken,
  rotateRefreshToken,
} = require('../src/lib/tokens');
const prisma = require('../src/lib/prisma');

// Verify DB exists; skip all tests if not.
const dbPath = path.resolve(__dirname, '..', 'dev.db');
const hasDb = fs.existsSync(dbPath) || !!process.env.DATABASE_URL;
const maybe = hasDb ? test : test.skip;

maybe('INO-001 v2: refresh-token rotation race', async (t) => {
  // Pick any ACTIVE user (admin/outlet/student all work for this test).
  const user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  if (!user) {
    console.warn('[tokens.race.test] No ACTIVE user in dev DB. Run `npm run db:seed` first.');
    return;
  }

  // Clean any existing refresh tokens for this user so we start clean.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  try {
    await t.test('exactly one of N concurrent rotates succeeds', async () => {
      // Issue one initial refresh token.
      const initial = await issueRefreshToken(user);
      assert.ok(
        typeof initial === 'string' && initial.includes('.'),
        'refresh token must have id.raw format'
      );

      // Fire N concurrent rotates of the SAME token.
      const N = 10;
      const settled = await Promise.allSettled(
        Array.from({ length: N }, () => rotateRefreshToken(initial))
      );

      // `rotateRefreshToken` returns `null` on failure and never throws
      // (it catches internally and re-throws only for unexpected errors).
      // AllSettled captures both paths.
      const successes = settled
        .filter((r) => r.status === 'fulfilled' && r.value !== null)
        .map((r) => r.value);

      const failures = settled.filter((r) => r.status === 'rejected');

      assert.strictEqual(
        failures.length,
        0,
        `unexpected rejections: ${failures.map(f => f.reason?.message || f.reason).join(', ')}`
      );

      assert.strictEqual(
        successes.length,
        1,
        `expected exactly 1 winner out of ${N} concurrent rotates, got ${successes.length}`
      );

      // The winner's replacement must be well-formed.
      const winner = successes[0];
      assert.ok(
        typeof winner.refreshToken === 'string' && winner.refreshToken.includes('.'),
        'replacement refresh token must have id.raw format'
      );
      assert.ok(
        typeof winner.accessToken === 'string' && winner.accessToken.split('.').length === 3,
        'winner must receive a signed JWT access token'
      );
      assert.strictEqual(
        winner.user.id,
        user.id,
        'winner user id must match the original user'
      );
    });

    await t.test('sequential replay of a rotated token returns null', async () => {
      // Fresh token + fresh rotation.
      const initial = await issueRefreshToken(user);
      const first = await rotateRefreshToken(initial);
      assert.ok(first, 'first rotate must succeed');

      // Replaying the SAME (already-rotated) token must fail.
      const replay = await rotateRefreshToken(initial);
      assert.strictEqual(replay, null, 'replay of rotated token must return null');

      // At this point all of the user's tokens should have been swept
      // (the replay triggered theft detection because `replacedBy` is set).
      const activeCount = await prisma.refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      });
      assert.strictEqual(
        activeCount,
        0,
        `expected 0 active tokens after theft-sweep, got ${activeCount}`
      );
    });

    await t.test('logout-revoked token does NOT nuke other sessions', async () => {
      // Issue two independent tokens for the user.
      const tokenA = await issueRefreshToken(user);
      const tokenB = await issueRefreshToken(user);

      // Revoke tokenA "by logout" (sets revokedAt, leaves replacedBy null).
      const { revokeRefreshToken } = require('../src/lib/tokens');
      const revoked = await revokeRefreshToken(tokenA);
      assert.strictEqual(revoked, true, 'revokeRefreshToken must return true on success');

      // Now try to rotate tokenA. Should return null (already revoked)
      // WITHOUT revoking tokenB.
      const result = await rotateRefreshToken(tokenA);
      assert.strictEqual(result, null, 'rotating a logout-revoked token must return null');

      // tokenB must still be active.
      const [tokenBRow] = await Promise.all([
        prisma.refreshToken.findUnique({
          where: { id: tokenB.split('.', 1)[0] },
        }),
      ]);
      assert.ok(tokenBRow, 'tokenB row must still exist');
      assert.strictEqual(
        tokenBRow.revokedAt,
        null,
        'tokenB must NOT be revoked (the v2 distinction: only-revokedAt tokens are not theft)'
      );
    });
  } finally {
    // Always clean up so the test is idempotent on re-run.
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  }
});
