/**
 * Crypto helper — AES-256-GCM encryption for at-rest storage of
 * per-outlet Razorpay credentials.
 *
 * Spec ref: §4 entity #4 (Outlet) — "Razorpay credentials are encrypted at
 * rest with AES-256-GCM using OUTLET_CREDENTIALS_KEY (separate from
 * JWT_SECRET)".
 *
 * Why GCM over CBC: GCM is authenticated — it produces a tag that detects
 * tampering. CBC is malleable.
 *
 * Output format: `<iv>:<authTag>:<ciphertext>` all base64.
 * The iv is unique per encryption (96 bits) — never reused with the same key.
 */

const crypto = require('crypto');

const KEY_ENV = 'OUTLET_CREDENTIALS_KEY';

function getKey() {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[crypto] ${KEY_ENV} is required in production. Generate with: openssl rand -base64 32`);
    }
    // Dev fallback — deterministic so seed data round-trips across reloads.
    // NEVER use this in production.
    return crypto.createHash('sha256').update('dev-only-insecure-key-do-not-use-in-prod').digest();
  }
  // Accept raw 32-byte strings OR base64-encoded 32 bytes.
  if (raw.length === 32) return Buffer.from(raw, 'utf8');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(`[crypto] ${KEY_ENV} must be 32 bytes (got ${buf.length}). Use: openssl rand -base64 32`);
  }
  return buf;
}

/**
 * Encrypt a UTF-8 string. Returns base64 of iv:tag:ciphertext.
 * @param {string} plaintext
 * @returns {string}
 */
function encrypt(plaintext) {
  if (plaintext == null) return null;
  if (typeof plaintext !== 'string') {
    throw new Error('[crypto.encrypt] plaintext must be a string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

/**
 * Decrypt an encrypted payload from encrypt(). Returns null if input is null.
 * @param {string|null} payload
 * @returns {string|null}
 */
function decrypt(payload) {
  if (!payload) return null;
  const key = getKey();
  const [ivB64, tagB64, encB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error('[crypto.decrypt] malformed ciphertext payload');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([
    decipher.update(enc),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/**
 * Constant-time string comparison — used for Razorpay webhook signature.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  encrypt,
  decrypt,
  safeEqual,
  // For tests only:
  _getKey: getKey,
};
