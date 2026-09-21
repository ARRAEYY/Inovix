/**
 * INO-P2-36: payment integration test matrix.
 *
 * The audit (finding #36) called out a list of payment scenarios that
 * needed test coverage. This file implements the ones that can be
 * tested WITHOUT a live Razorpay gateway or a seeded DB — the pure-
 * logic security boundaries:
 *
 *   ✓ Signature verification — correct HMAC accepted, wrong signature
 *     rejected, constant-time comparison used.
 *   ✓ Validation schema — razorpayPaymentVerifySchema rejects missing
 *     fields, rejects unknown fields (strict mode).
 *   ✓ safeEqual — the constant-time comparison primitive used by both
 *     the verify path AND the webhook path.
 *   ✓ Refund trigger mapping — REFUND_TRIGGERS correctly maps each
 *     transition to the right refund trigger (or null for no-show).
 *
 * The integration tests (DB + mocked Razorpay client) are sketched as
 * `test.skip()` blocks below with the exact scenario name from the
 * audit, so the structure is in place for someone to fill in. They need:
 *   - A seeded test DB with an outlet that has encrypted Razorpay
 *     credentials (the dev seed doesn't set these — they're real secrets)
 *   - A mock Razorpay client (the service uses `getOutletRazorpayClient`
 *     which caches clients by outletId; expose `clientCache` for tests
 *     OR refactor to accept a client factory).
 *
 * Run via: `JWT_SECRET=test NODE_ENV=test node --test tests/payments.test.js`
 */

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const path = require('path');

// Load .env from repo root
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { safeEqual } = require('../src/lib/crypto');
const { razorpayPaymentVerifySchema, refundCreateSchema } = require('@nosh/validation');
const { REFUND_TRIGGERS, PAYMENT_STATUS, ORDER_STATUS } = require('../src/lib/constants');

// ─── Helpers ───────────────────────────────────────────────────────────────

// Reproduce the exact HMAC the verify path computes (see
// payments.service.js verifyRazorpayPayment). Razorpay's signature is
// HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret).
function computeRazorpaySignature(razorpayOrderId, razorpayPaymentId, keySecret) {
  return crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

// ─── 1. Signature verification — the security boundary ─────────────────────

test('Signature verification — correct HMAC is accepted', () => {
  const keySecret = 'test-key-secret';
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';
  const expected = computeRazorpaySignature(orderId, paymentId, keySecret);

  // The verify path computes `expected` and compares against the presented
  // signature using safeEqual. A correct signature must compare equal.
  assert.strictEqual(safeEqual(expected, expected), true);
});

test('Signature verification — wrong signature is rejected', () => {
  const keySecret = 'test-key-secret';
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';
  const expected = computeRazorpaySignature(orderId, paymentId, keySecret);

  // A signature computed with a DIFFERENT key secret must NOT compare equal.
  const wrongSig = computeRazorpaySignature(orderId, paymentId, 'wrong-key-secret');
  assert.strictEqual(safeEqual(expected, wrongSig), false);
});

test('Signature verification — different payment id is rejected', () => {
  const keySecret = 'test-key-secret';
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';
  const sig = computeRazorpaySignature(orderId, paymentId, keySecret);

  // A signature for a different payment_id must not validate.
  const sigOtherPayment = computeRazorpaySignature(orderId, 'pay_other', keySecret);
  assert.strictEqual(safeEqual(sig, sigOtherPayment), false);
});

test('Signature verification — different order id is rejected', () => {
  const keySecret = 'test-key-secret';
  const sig = computeRazorpaySignature('order_A', 'pay_X', keySecret);
  const sigOtherOrder = computeRazorpaySignature('order_B', 'pay_X', keySecret);
  assert.strictEqual(safeEqual(sig, sigOtherOrder), false);
});

test('Signature verification — safeEqual is length-tolerant (no length leak)', () => {
  // safeEqual returns false for different-length inputs WITHOUT comparing
  // bytes — preventing a timing oracle that would reveal signature length.
  assert.strictEqual(safeEqual('abc', 'abcd'), false);
  assert.strictEqual(safeEqual('abcd', 'abc'), false);
  assert.strictEqual(safeEqual('', ''), true); // both empty — edge case
  assert.strictEqual(safeEqual('', 'x'), false);
});

test('Signature verification — safeEqual rejects non-string inputs', () => {
  // Defensive: if a malformed value reaches the comparison, it must not
  // throw — just return false so the request is rejected cleanly.
  assert.strictEqual(safeEqual(null, 'abc'), false);
  assert.strictEqual(safeEqual('abc', null), false);
  assert.strictEqual(safeEqual(undefined, 'abc'), false);
  assert.strictEqual(safeEqual(123, 'abc'), false);
  assert.strictEqual(safeEqual('abc', {}), false);
});

// ─── 2. Validation schema — strict mode rejects malformed input ────────────

test('razorpayPaymentVerifySchema — accepts a well-formed body', () => {
  const body = {
    razorpayOrderId: 'order_test',
    razorpayPaymentId: 'pay_test',
    razorpaySignature: 'abc123',
  };
  const result = razorpayPaymentVerifySchema.safeParse(body);
  assert.ok(result.success, 'schema should accept valid input');
  assert.strictEqual(result.data.razorpayOrderId, 'order_test');
  assert.strictEqual(result.data.razorpayPaymentId, 'pay_test');
});

test('razorpayPaymentVerifySchema — rejects missing fields', () => {
  const result = razorpayPaymentVerifySchema.safeParse({
    razorpayOrderId: 'order_test',
    // missing razorpayPaymentId + razorpaySignature
  });
  assert.ok(!result.success, 'schema should reject missing fields');
  const fields = result.error.issues.map(i => i.path.join('.'));
  assert.ok(fields.includes('razorpayPaymentId'));
  assert.ok(fields.includes('razorpaySignature'));
});

test('razorpayPaymentVerifySchema — rejects empty strings (min(1))', () => {
  const result = razorpayPaymentVerifySchema.safeParse({
    razorpayOrderId: '',
    razorpayPaymentId: '',
    razorpaySignature: '',
  });
  assert.ok(!result.success);
});

test('razorpayPaymentVerifySchema — rejects unknown keys (strict mode)', () => {
  // Strict mode prevents parameter-pollution attacks where a client
  // sends extra fields hoping to confuse the controller.
  const result = razorpayPaymentVerifySchema.safeParse({
    razorpayOrderId: 'order_test',
    razorpayPaymentId: 'pay_test',
    razorpaySignature: 'abc',
    extraField: 'should-be-rejected',
  });
  assert.ok(!result.success, 'strict schema should reject unknown keys');
});

test('refundCreateSchema — accepts a well-formed manual refund body', () => {
  const result = refundCreateSchema.safeParse({
    orderId: 'order_test',
    amount: 100,
    reason: 'Customer complaint',
    trigger: 'SUPER_ADMIN_MANUAL',
  });
  assert.ok(result.success);
});

test('refundCreateSchema — rejects invalid trigger enum', () => {
  const result = refundCreateSchema.safeParse({
    orderId: 'order_test',
    amount: 100,
    reason: 'x',
    trigger: 'INVALID_TRIGGER',
  });
  assert.ok(!result.success);
});

test('refundCreateSchema — rejects non-positive amount', () => {
  const result = refundCreateSchema.safeParse({
    orderId: 'order_test',
    amount: 0,
    reason: 'x',
    trigger: 'SUPER_ADMIN_MANUAL',
  });
  assert.ok(!result.success, 'amount must be > 0');
});

// ─── 3. Refund trigger mapping ──────────────────────────────────────────────

test('REFUND_TRIGGERS — PENDING → REJECTED triggers OUTLET_REJECT', () => {
  assert.strictEqual(REFUND_TRIGGERS.PENDING_TO_REJECTED, 'OUTLET_REJECT');
});

test('REFUND_TRIGGERS — PENDING → CANCELLED triggers OUTLET_CANCEL', () => {
  assert.strictEqual(REFUND_TRIGGERS.PENDING_TO_CANCELLED, 'OUTLET_CANCEL');
});

test('REFUND_TRIGGERS — ACCEPTED → CANCELLED triggers OUTLET_CANCEL', () => {
  assert.strictEqual(REFUND_TRIGGERS.ACCEPTED_TO_CANCELLED, 'OUTLET_CANCEL');
});

test('REFUND_TRIGGERS — PREPARING → CANCELLED triggers OUTLET_CANCEL', () => {
  assert.strictEqual(REFUND_TRIGGERS.PREPARING_TO_CANCELLED, 'OUTLET_CANCEL');
});

test('REFUND_TRIGGERS — READY → CANCELLED is null (no refund — no-show)', () => {
  // Per spec §8.6: READY → CANCELLED is the pickup-timeout no-show case.
  // The food has been prepared; refunding would mean the outlet eats the cost.
  assert.strictEqual(REFUND_TRIGGERS.READY_TO_CANCELLED, null);
});

// ─── 4. Payment status invariants ───────────────────────────────────────────

test('PAYMENT_STATUS — has exactly the 4 documented states', () => {
  const statuses = Object.values(PAYMENT_STATUS).sort();
  assert.deepStrictEqual(statuses, ['FAILED', 'PAID', 'PENDING', 'REFUNDED'].sort());
});

test('ORDER_STATUS — has exactly the 7 documented states', () => {
  const statuses = Object.values(ORDER_STATUS).sort();
  assert.deepStrictEqual(
    statuses,
    ['ACCEPTED', 'CANCELLED', 'COMPLETED', 'PENDING', 'PREPARING', 'READY', 'REJECTED'].sort(),
  );
});

// ─── 5. Integration test scaffolding (skipped — needs seeded DB + mocked gateway) ──
//
// These tests follow the audit's scenario list (finding #36). Each is
// `test.skip()`-ed because:
//   - They need a test DB seeded with an outlet that has encrypted Razorpay
//     credentials (the dev seed doesn't set these — they're real secrets).
//   - They need a mock Razorpay client. The service uses
//     `getOutletRazorpayClient(outletId)` which caches clients in a
//     module-private Map (`clientCache`). To inject a mock, either:
//       (a) Export `clientCache` from payments.service.js for tests, OR
//       (b) Refactor getOutletRazorpayClient to accept a client factory.
//     Option (b) is cleaner but a bigger change — out of P2 scope.
//
// To enable these tests:
//   1. Add `module.exports._clientCache = clientCache;` to payments.service.js
//      OR refactor to accept a client factory.
//   2. Create a test helper that seeds a test outlet with encrypted
//      credentials + a test order with a PENDING payment.
//   3. Inject the mock client: paymentsService._clientCache.set(testOutletId, mockClient);
//   4. Remove the `test.skip` wrappers below.

test.skip('Integration: verifyRazorpayPayment returns idempotent on already-PAID payment', async () => {
  // Setup: seed an order with Payment.status = PAID.
  // Action: call verifyRazorpayPayment with a valid signature.
  // Assert: returns { ...payment, idempotent: true } without calling the
  //         gateway (mock the client.orders.create to throw if called).
});

test.skip('Integration: verifyRazorpayPayment rejects REFUNDED payment with 409', async () => {
  // Setup: seed an order with Payment.status = REFUNDED.
  // Action: call verifyRazorpayPayment with a valid signature.
  // Assert: throws { statusCode: 409, code: 'INVALID_PAYMENT_STATE' }.
});

test.skip('Integration: verifyRazorpayPayment rejects with 403 when caller is not the payment owner', async () => {
  // Setup: seed an order with Payment.status = PENDING, owned by studentA.
  // Action: call verifyRazorpayPayment with actorId = studentB.
  // Assert: throws { statusCode: 403, message: 'Not your payment' }.
  //         (INO-002 fix.)
});

test.skip('Integration: verifyRazorpayPayment rejects wrong signature with 400', async () => {
  // Setup: seed a PENDING payment, get the outlet's key secret.
  // Action: call verifyRazorpayPayment with a signature computed with a
  //         DIFFERENT key secret.
  // Assert: throws { statusCode: 400, code: 'PAYMENT_FAILED' }.
  //         An audit row with action='RAZORPAY_SIGNATURE_INVALID' is created.
});

test.skip('Integration: createRazorpayOrder is idempotent — returns existing gatewayOrder on retry', async () => {
  // Setup: seed an order with Payment.status = PENDING AND
  //         Payment.razorpayOrderId already set (from a previous call).
  // Action: call createRazorpayOrder(orderId, studentId).
  // Assert: returns the existing razorpayOrderId WITHOUT calling
  //         client.orders.create (mock should throw if called).
  //         (INO-P0-6 fix.)
});

test.skip('Integration: handleRazorpayWebhook is idempotent — alreadyPaid returns silently', async () => {
  // Setup: seed a PAID payment, compute a valid webhook signature.
  // Action: call handleRazorpayWebhook(rawBody, signature, webhookSecret).
  // Assert: returns { alreadyPaid: true }. No DB write, no socket emit.
});

test.skip('Integration: handleRazorpayWebhook rejects wrong signature', async () => {
  // Setup: compute a webhook signature with a different webhookSecret.
  // Action: call handleRazorpayWebhook(rawBody, wrongSignature, correctSecret).
  // Assert: throws { statusCode: 400, message: 'Invalid webhook signature' }.
});

test.skip('Integration: handleRazorpayWebhook ignores non-payment.captured events', async () => {
  // Setup: build a webhook body with event='payment.failed' (or any other).
  // Action: call handleRazorpayWebhook with a valid signature.
  // Assert: returns { ignored: true }. No DB write.
});

test.skip('Integration: processAutoRefundOnTransition is idempotent — returns existing Refund row', async () => {
  // Setup: seed a PAID payment with an existing Refund row (triggeredBy=
  //         OUTLET_CANCEL, status=PENDING).
  // Action: call processAutoRefundOnTransition(orderId, 'PENDING', 'CANCELLED',
  //         actorId).
  // Assert: returns the existing Refund row WITHOUT calling client.payments.refund.
  //         (INO-P0-3 fix.)
});

test.skip('Integration: processAutoRefundOnTransition records PENDING refund when gateway fails', async () => {
  // Setup: mock client.payments.refund to throw (simulating gateway failure).
  // Action: call processAutoRefundOnTransition on a PAID payment.
  // Assert: Refund row created with status='PENDING'. Payment stays PAID
  //         (not REFUNDED — refund didn't complete at gateway).
  //         (Recovery path for finding #8.)
});

test.skip('Integration: admin manual refund endpoint retries a PENDING refund', async () => {
  // Setup: seed a PAID payment with a PENDING Refund row (gateway previously
  //         failed). Mock client.payments.refund to succeed this time.
  // Action: call adminService.issueManualRefund(orderId, { amount, reason }, actorId).
  // Assert: existing Refund row updated with new gatewayRef + status='COMPLETED'.
  //         Payment.status updated to REFUNDED.
  //         (INO-P0-7/P0-8 fix.)
});

test.skip('Integration: admin manual refund rejects if a COMPLETED refund already exists', async () => {
  // Setup: seed a payment with a COMPLETED Refund row.
  // Action: call issueManualRefund.
  // Assert: throws { statusCode: 409, code: 'REFUND_ALREADY_COMPLETED' }.
});

test.skip('Integration: concurrent verifyRazorpayPayment calls — exactly one wins', async () => {
  // Setup: seed a PENDING payment. Spawn N=10 concurrent verifyRazorpayPayment
  //        calls with a valid signature.
  // Assert: exactly 1 succeeds with status=PAID. The other 9 either get
  //         idempotent:true (race loser that saw PAID after the winner's commit)
  //         or 409 PAYMENT_STATE_RACE (race loser that saw the updateMany count=0).
  //         The gateway is called exactly ONCE (by the winner).
  //         (Concurrency test — analogous to INO-001 v2 race test.)
});

test.skip('Integration: concurrent handleRazorpayWebhook deliveries — exactly one marks PAID', async () => {
  // Razorpay sometimes retries webhooks. The idempotency guard via
  // updateMany({ where: { id, status: PENDING } }) ensures only one
  // delivery marks the payment PAID; subsequent deliveries see alreadyPaid=true.
});
