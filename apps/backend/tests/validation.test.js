const test = require('node:test');
const assert = require('node:assert');
const { validateBody } = require('../src/middleware/validation.middleware');
const { createOrderSchema } = require('../../../packages/validation/src/index');
const { ERROR_CODES } = require('../src/lib/constants');

test('Validation Middleware Tests', async (t) => {
    
    await t.test('valid body passes and is sanitized', () => {
        const req = {
            body: {
                outletId: 'outlet-1',
                items: [{ menuItemId: 'item-1', quantity: 2 }],
                paymentMethod: 'online',
                notes: '  Please no onions  ',
                extraJunk: true // Should be removed by safeParse/strip depending on zod config, but we actually just replace body
            }
        };
        const res = {};
        let error;
        const next = (err) => { error = err; };

        validateBody(createOrderSchema)(req, res, next);
        
        assert.strictEqual(error, undefined);
        assert.strictEqual(req.body.outletId, 'outlet-1');
        assert.strictEqual(req.body.paymentMethod, 'online');
        // Extra junk will be removed because zod strips by default for standard objects
        assert.strictEqual(req.body.extraJunk, undefined);
    });

    await t.test('invalid body returns 400 immediately (does not call next(err))', () => {
        const req = {
            body: {
                // missing outletId
                items: [], // empty items
                paymentMethod: 'invalid-method',
            }
        };
        
        let statusCode;
        let responseBody;
        
        const res = {
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (body) => {
                responseBody = body;
            }
        };
        
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        validateBody(createOrderSchema)(req, res, next);
        
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(statusCode, 400);
        assert.strictEqual(responseBody.success, false);
        assert.strictEqual(responseBody.code, ERROR_CODES.VALIDATION_ERROR);
        assert.ok(responseBody.errors.length > 0);
        
        // Check specific errors
        const hasOutletError = responseBody.errors.some(e => e.field === 'outletId');
        const hasItemsError = responseBody.errors.some(e => e.field === 'items');
        const hasPaymentError = responseBody.errors.some(e => e.field === 'paymentMethod');
        
        assert.ok(hasOutletError);
        assert.ok(hasItemsError);
        assert.ok(hasPaymentError);
    });
});
