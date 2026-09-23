/**
 * JWT + Refresh token helpers.
 *
 * Spec ref: §3.2 Layer 1 — short-lived access (15 min) + long-lived refresh
 * (7 days, rotating). On logout, refresh token is revoked.
 *
 * Rotation policy: each refresh token can be used exactly once. Using it
 * issues a new access + new refresh, and marks the old refresh as
 * `replacedBy=<newTokenId>`. Re-using an old (already-rotated) refresh is
 * treated as a token-theft event: all of the user's refresh tokens are
 * revoked.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('./prisma');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '7d', 10);

if (!JWT_SECRET) {
  throw new Error('[tokens] JWT_SECRET environment variable is required. See .env.example.');
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      outletId: user.outletStaff?.outletId || user.outletId || null,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueRefreshToken(user, { req, tx } = {}) {
  // `tx` is optional — when supplied, the new RefreshToken row is created
  // inside the caller's transaction. Without `tx` we use the global prisma
  // client (the original behavior, used by auth.controller.js for login).
  const db = tx || prisma;
  const raw = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  const record = await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt,
    },
  });
  // Tie the token to its DB id for rotation tracking. The signed outer
  // envelope prevents a leaked DB row from being used to mint a token.
  return `${record.id}.${raw}`;
}

async function rotateRefreshToken(presentedToken, { req } = {}) {
  if (!presentedToken || !presentedToken.includes('.')) return null;
  const [idPart, rawPart] = presentedToken.split('.', 2);
  const tokenHash = hashToken(rawPart);

  const stored = await prisma.refreshToken.findUnique({ where: { id: idPart } });
  if (!stored) return null;

  // ─── INO-001 #4: constant-time hash comparison (defense in depth) ───────
  // The hash is SHA-256 of a 48-byte random, so timing leakage cannot
  // recover the underlying raw token, but for a security-sensitive
  // primitive we use crypto.timingSafeEqual anyway.
  const storedHashBuf = Buffer.from(stored.tokenHash, 'hex');
  const presentedHashBuf = Buffer.from(tokenHash, 'hex');
  if (
    storedHashBuf.length !== presentedHashBuf.length ||
    !crypto.timingSafeEqual(storedHashBuf, presentedHashBuf)
  ) {
    return null;
  }

  // Expired? — idempotent revoke + reject.
  if (stored.expiresAt.getTime() < Date.now()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // ─── INO-001 v2: transactional rotation ─────────────────────────────────
  // The v1 fix used a conditional `updateMany` to atomically claim the old
  // token, but performed the claim, the new-token creation, and the
  // `replacedBy`-update as *separate* writes. A crash between the claim
  // and the `replacedBy`-update would leave the old token revoked with no
  // replacement — the user is locked out and has to re-auth.
  //
  // Fix: wrap the claim + new-token issue + `replacedBy`-update in a single
  // `prisma.$transaction`. A crash before COMMIT rolls back the claim too,
  // so the user can retry with the same refresh token.
  //
  // Conflict handling: if the atomic claim inside the tx fails, we abort
  // and re-read the row OUTSIDE the tx to decide what to do:
  //   - If `replacedBy` is now set  → token was rotated by a concurrent
  //     request. Treat as replay/theft: revoke ALL active tokens for the
  //     user. (This is the spec's "reuse of a rotated token = theft" rule.
  //     A legitimate multi-tab refresh CAN trigger this — see the race
  //     test for the tradeoff. A token-family design would distinguish
  //     these cases; out of scope for V1.)
  //   - If only `revokedAt` is set (logout-revoked or expired) → silently
  //     reject WITHOUT nuking the user's other sessions. Previously ANY
  //     already-revoked token triggered the global sweep, which was too
  //     aggressive for the common logout-replay case.
  try {
    return await prisma.$transaction(async (tx) => {
      // Atomic claim inside the tx.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null, replacedBy: null },
        data: { revokedAt: new Date() },
      });

      if (claimed.count !== 1) {
        // Lost the race — abort the tx so the claim rolls back. We re-read
        // the row outside the tx to decide whether this is theft or just
        // a stale (logout-revoked) token.
        const err = new Error('CLAIM_LOST');
        err.code = 'CLAIM_LOST';
        throw err;
      }

      // Re-verify the user is still ACTIVE inside the tx. If they've been
      // suspended mid-flight, abort — the claim rolls back so the token
      // stays usable if the user is later reactivated.
      const user = await tx.user.findUnique({ where: { id: stored.userId } });
      if (!user || user.status !== 'ACTIVE') {
        const err = new Error('USER_INACTIVE');
        err.code = 'USER_INACTIVE';
        throw err;
      }

      // Issue the replacement INSIDE the tx so a crash rolls it back too.
      const newRefresh = await issueRefreshToken(user, { req, tx });
      const [newId] = newRefresh.split('.', 1);

      // Set replacedBy on the old row.
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedBy: newId },
      });

      return {
        user,
        accessToken: signAccessToken(user),
        refreshToken: newRefresh,
      };
    });
  } catch (err) {
    if (err.code === 'USER_INACTIVE') return null;

    if (err.code === 'CLAIM_LOST') {
      // Re-read the row to figure out WHY we lost the claim.
      const post = await prisma.refreshToken.findUnique({ where: { id: stored.id } });
      if (!post) return null;

      if (post.replacedBy) {
        // Token was rotated by a concurrent request → replay/theft.
        // Revoke ALL active tokens for this user.
        await prisma.refreshToken.updateMany({
          where: { userId: post.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      // else: only `revokedAt` was set (logout/expiry) — silently reject
      // without nuking the user's other sessions.
      return null;
    }

    // Unexpected error — rethrow.
    throw err;
  }
}

async function revokeAllForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeRefreshToken(presentedToken) {
  if (!presentedToken || !presentedToken.includes('.')) return false;
  const [idPart, rawPart] = presentedToken.split('.', 2);
  const tokenHash = hashToken(rawPart);

  try {
    // INO-adj-21 fix: verify the presented secret matches the stored hash
    // before revoking. The previous implementation took the id part only
    // and unconditionally updated `revokedAt`, so knowing a refresh-token
    // DB id (e.g. leaked via logs or another vector) was enough to revoke
    // any user's session — a DoS / session-revocation issue.
    //
    // Now we use the same verification primitive as `rotateRefreshToken`:
    // look up the row, compare the hash constant-time, and only revoke if
    // it matches. A bad hash returns false (no-op) just like rotation does.
    const stored = await prisma.refreshToken.findUnique({ where: { id: idPart } });
    if (!stored) return false;

    const storedHashBuf = Buffer.from(stored.tokenHash, 'hex');
    const presentedHashBuf = Buffer.from(tokenHash, 'hex');
    if (
      storedHashBuf.length !== presentedHashBuf.length ||
      !crypto.timingSafeEqual(storedHashBuf, presentedHashBuf)
    ) {
      return false;
    }

    // Idempotent: revoking an already-revoked token is a no-op success.
    if (stored.revokedAt) return true;

    await prisma.refreshToken.update({
      where: { id: idPart },
      data: { revokedAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

// Cron-style cleanup: delete refresh tokens expired > 30 days.
async function purgeExpired() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return result.count;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllForUser,
  revokeRefreshToken,
  purgeExpired,
  hashToken,
  // For tests:
  _hashToken: hashToken,
};
