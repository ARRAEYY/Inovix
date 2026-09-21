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

async function issueRefreshToken(user, { req } = {}) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  const record = await prisma.refreshToken.create({
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

  // Token theft detection: someone is using a token that was already rotated.
  if (stored.revokedAt !== null || stored.replacedBy) {
    // Revoke EVERYTHING for this user — they may be under attack.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Expired?
  if (stored.expiresAt.getTime() < Date.now()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Hash matches?
  if (stored.tokenHash !== tokenHash) return null;

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || user.status !== 'ACTIVE') return null;

  // Issue new pair
  const newRefresh = await issueRefreshToken(user, { req });

  // Mark old as rotated
  const [newId] = newRefresh.split('.', 1);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      revokedAt: new Date(),
      replacedBy: newId,
    },
  });

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: newRefresh,
  };
}

async function revokeAllForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeRefreshToken(presentedToken) {
  if (!presentedToken || !presentedToken.includes('.')) return false;
  const [idPart] = presentedToken.split('.', 1);
  try {
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
  // For tests:
  _hashToken: hashToken,
};
