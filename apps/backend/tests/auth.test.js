/**
 * Auth middleware tests — integration style.
 *
 * The middleware now uses Prisma to look up the live user record (instead of
 * the deleted mockUsers array). These tests run against the seeded dev SQLite
 * database (dev.db) created by `npm run db:migrate && npm run db:seed`.
 *
 * Run via: `JWT_SECRET=test node --test tests/auth.test.js`
 *
 * Skips gracefully if DATABASE_URL is not set or the dev.db is missing.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Load .env from repo root
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { protect } = require('../src/middleware/auth.middleware');
const { USER_STATUS, ERROR_CODES } = require('../src/lib/constants');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');

// Verify DB exists; skip all tests if not.
const dbPath = path.resolve(__dirname, '..', 'dev.db');
const hasDb = fs.existsSync(dbPath) || !!process.env.DATABASE_URL;

const maybe = hasDb ? test : test.skip;

maybe('Auth Middleware Tests', async (t) => {
  let testUser;

  async function getTestUser() {
    if (testUser) return testUser;
    testUser = await prisma.user.findUnique({
      where: { email: 'adilreyaz.admin@nosh.local' },
    });
    return testUser;
  }

  await t.test('missing auth header returns 401 UNAUTHORIZED', async () => {
    const req = { headers: {} };
    const res = {};
    let error;
    const next = (err) => { error = err; };

    await protect(req, res, next);

    assert.ok(error);
    assert.strictEqual(error.statusCode, 401);
    assert.strictEqual(error.code, ERROR_CODES.UNAUTHORIZED);
  });

  await t.test('invalid token returns 401 UNAUTHORIZED', async () => {
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = {};
    let error;
    const next = (err) => { error = err; };

    await protect(req, res, next);

    assert.ok(error);
    assert.strictEqual(error.statusCode, 401);
    assert.strictEqual(error.code, ERROR_CODES.UNAUTHORIZED);
  });

  await t.test('valid token for active user sets req.user', async () => {
    const user = await getTestUser();
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let error;
    const next = (err) => { error = err; };

    await protect(req, res, next);

    assert.strictEqual(error, undefined);
    assert.ok(req.user);
    assert.strictEqual(req.user.id, user.id);
    assert.strictEqual(req.user.role, user.role);
  });

  await t.test('suspended user returns 401 ACCOUNT_SUSPENDED', async () => {
    const user = await getTestUser();
    const originalStatus = user.status;
    // Temporarily suspend
    await prisma.user.update({ where: { id: user.id }, data: { status: USER_STATUS.SUSPENDED } });

    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let error;
    const next = (err) => { error = err; };

    await protect(req, res, next);

    assert.ok(error);
    assert.strictEqual(error.statusCode, 401);
    assert.strictEqual(error.code, ERROR_CODES.ACCOUNT_SUSPENDED);

    // Restore
    await prisma.user.update({ where: { id: user.id }, data: { status: originalStatus } });
  });

  await t.test('nonexistent user id in token returns 401 UNAUTHORIZED', async () => {
    // Sign a token for an id that doesn't exist in DB
    const token = jwt.sign({ sub: 'nonexistent-user-id', email: 'ghost@example.com', role: 'STUDENT' }, process.env.JWT_SECRET);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let error;
    const next = (err) => { error = err; };

    await protect(req, res, next);

    assert.ok(error);
    assert.strictEqual(error.statusCode, 401);
    assert.strictEqual(error.code, ERROR_CODES.UNAUTHORIZED);
  });
});
