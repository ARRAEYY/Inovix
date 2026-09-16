const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { USER_STATUS, ERROR_CODES } = require('../src/lib/constants');

// Need a test server instance and some mocks/tools for tests
// Since this is just foundational tests, we'll mock request/response for the middleware
const { protect } = require('../src/middleware/auth.middleware');
const mockUsers = require('../src/data/mockUsers');
const jwt = require('jsonwebtoken');

test('Auth Middleware Tests', async (t) => {
    await t.test('missing auth header returns 401', () => {
        const req = { headers: {} };
        const res = {};
        
        let error;
        const next = (err) => { error = err; };

        protect(req, res, next);
        
        assert.ok(error);
        assert.strictEqual(error.statusCode, 401);
        assert.strictEqual(error.code, ERROR_CODES.UNAUTHORIZED);
    });

    await t.test('invalid token returns 401', () => {
        const req = { headers: { authorization: 'Bearer bad-token' } };
        const res = {};
        
        let error;
        const next = (err) => { error = err; };

        protect(req, res, next);
        
        assert.ok(error);
        assert.strictEqual(error.statusCode, 401);
        assert.strictEqual(error.code, ERROR_CODES.UNAUTHORIZED);
    });

    await t.test('valid token for active user sets req.user', () => {
        const user = mockUsers[0]; // Active user
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
        
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = {};
        
        let error;
        const next = (err) => { error = err; };

        protect(req, res, next);
        
        assert.strictEqual(error, undefined);
        assert.ok(req.user);
        assert.strictEqual(req.user.id, user.id);
        assert.strictEqual(req.user.role, user.role);
    });

    await t.test('suspended user returns 401 ACCOUNT_SUSPENDED', () => {
        // Temporarily suspend a user
        const user = mockUsers[0];
        const originalStatus = user.status;
        user.status = USER_STATUS.SUSPENDED;
        
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
        
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = {};
        
        let error;
        const next = (err) => { error = err; };

        protect(req, res, next);
        
        assert.ok(error);
        assert.strictEqual(error.statusCode, 401);
        assert.strictEqual(error.code, ERROR_CODES.ACCOUNT_SUSPENDED);
        
        // Restore status
        user.status = originalStatus;
    });
});
