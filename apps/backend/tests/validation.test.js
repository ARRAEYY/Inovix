const test = require('node:test');
const assert = require('node:assert');
const { validateBody } = require('../src/middleware/validation.middleware');
const { createOrderSchema, onboardingSchema, devLoginSchema } = require('@nosh/validation');
const { ERROR_CODES } = require('../src/lib/constants');

// Minimal mock res — supports both success path (next() called) and failure
// path (res.status().json()) without depending on Express.
function mockRes() {
  let statusCode, body;
  return {
    status(c) { statusCode = c; return this; },
    json(b) { body = b; return this; },
    _getStatusCode() { return statusCode; },
    _getBody() { return body; },
  };
}

test('Validation Middleware Tests', async (t) => {

  await t.test('valid body passes; req.body replaced with parsed+coerced data', () => {
    const req = {
      body: {
        outletId: 'outlet-1',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
        paymentMethod: 'ONLINE',
        notes: '  Please no onions  ',
      },
    };
    const res = mockRes();
    let error;
    let nextCalled = false;
    const next = (err) => { error = err; nextCalled = true; };

    validateBody(createOrderSchema)(req, res, next);

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(error, undefined);
    assert.strictEqual(req.body.outletId, 'outlet-1');
    assert.strictEqual(req.body.paymentMethod, 'ONLINE');
    // Coerced quantity is a number
    assert.strictEqual(req.body.items[0].quantity, 2);
  });

  await t.test('strict mode REJECTS unknown keys (parameter-pollution defense)', () => {
    const req = {
      body: {
        outletId: 'outlet-1',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
        paymentMethod: 'ONLINE',
        extraJunk: true,
      },
    };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    validateBody(createOrderSchema)(req, res, next);

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res._getStatusCode(), 400);
    const body = res._getBody();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.code, ERROR_CODES.VALIDATION_ERROR);
    assert.ok(body.errors.length > 0);
  });

  await t.test('invalid body returns 400 with field-level errors', () => {
    const req = {
      body: {
        // missing outletId
        items: [], // empty items
        paymentMethod: 'invalid-method', // not in enum
      },
    };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    validateBody(createOrderSchema)(req, res, next);

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res._getStatusCode(), 400);
    const body = res._getBody();
    assert.strictEqual(body.code, ERROR_CODES.VALIDATION_ERROR);
    assert.ok(body.errors.length > 0);

    const fields = body.errors.map(e => e.field);
    assert.ok(fields.includes('outletId'), `Expected 'outletId' in errors, got: ${fields.join(', ')}`);
    assert.ok(fields.includes('items'), `Expected 'items' in errors, got: ${fields.join(', ')}`);
    assert.ok(fields.includes('paymentMethod'), `Expected 'paymentMethod' in errors, got: ${fields.join(', ')}`);
  });

  await t.test('onboarding schema: weak password fails with explicit message', () => {
    const req = {
      body: {
        password: 'weak', // missing uppercase + digit
        profile: { fullName: 'Test User', phone: '9876543210', course: 'B.Tech', year: '2', collegeId: 'RU123' },
      },
    };
    const res = mockRes();
    validateBody(onboardingSchema)(req, res, () => {});
    assert.strictEqual(res._getStatusCode(), 400);
    assert.ok(res._getBody().errors.some(e => e.field === 'password'));
  });

  await t.test('devLogin schema: invalid email is rejected', () => {
    const req = { body: { email: 'not-an-email' } };
    const res = mockRes();
    validateBody(devLoginSchema)(req, res, () => {});
    assert.strictEqual(res._getStatusCode(), 400);
    assert.ok(res._getBody().errors.some(e => e.field === 'email'));
  });
});
