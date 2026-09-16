const test = require('node:test');
const assert = require('node:assert');
const { authorizeRole } = require('../src/middleware/auth.middleware');
const { ROLES, ERROR_CODES } = require('../src/lib/constants');

test('RBAC Middleware Tests', async (t) => {
    
    await t.test('allows matching single role', () => {
        const req = { user: { role: ROLES.STUDENT } };
        const res = {};
        let error;
        const next = (err) => { error = err; };

        authorizeRole(ROLES.STUDENT)(req, res, next);
        
        assert.strictEqual(error, undefined);
    });

    await t.test('allows matching role from multiple allowed roles', () => {
        const req = { user: { role: ROLES.OUTLET_STAFF } };
        const res = {};
        let error;
        const next = (err) => { error = err; };

        authorizeRole(ROLES.OUTLET_ADMIN, ROLES.OUTLET_STAFF)(req, res, next);
        
        assert.strictEqual(error, undefined);
    });

    await t.test('rejects unmatching role', () => {
        const req = { user: { role: ROLES.STUDENT } };
        const res = {};
        let error;
        const next = (err) => { error = err; };

        authorizeRole(ROLES.SUPER_ADMIN)(req, res, next);
        
        assert.ok(error);
        assert.strictEqual(error.statusCode, 403);
        assert.strictEqual(error.code, ERROR_CODES.FORBIDDEN);
    });

    await t.test('rejects when no user role present', () => {
        const req = { user: {} };
        const res = {};
        let error;
        const next = (err) => { error = err; };

        authorizeRole(ROLES.STUDENT)(req, res, next);
        
        assert.ok(error);
        assert.strictEqual(error.statusCode, 403);
        assert.strictEqual(error.code, ERROR_CODES.FORBIDDEN);
    });
    
    await t.test('rejects when no user object present', () => {
        const req = {};
        const res = {};
        let error;
        const next = (err) => { error = err; };

        authorizeRole(ROLES.STUDENT)(req, res, next);
        
        assert.ok(error);
        assert.strictEqual(error.statusCode, 403);
        assert.strictEqual(error.code, ERROR_CODES.FORBIDDEN);
    });
});
