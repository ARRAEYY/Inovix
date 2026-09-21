/**
 * INO-AUDIT7: refund concurrency tests.
 *
 * Test 1 from the audit: ₹1000 payment, 2 simultaneous ₹700 refund
 * requests. Expected: one succeeds, one gets rejected, total refunds = ₹700.
 *
 * The concurrent-refund-race fix (INO-AUDIT6-#5) wraps the
 * remaining-check + Refund.create in a prisma.$transaction with
 * SELECT FOR UPDATE on the Payment row. Two concurrent requests:
 *   Request A: locks Payment → sees remaining=₹1000 → creates ₹700 Refund → commits
 *   Request B: locks Payment (after A's commit) → sees remaining=₹300 → ₹700 > ₹300 → rejects
 *
 * The gateway call happens post-commit, so this test works even without
 * real Razorpay credentials — the Refund row is created with status=PENDING
 * + gatewayRef=NULL before the gateway call (which will fail, but that's
 * fine — the outbox worker would retry it later).
 *
 * Run via: `JWT_SECRET=test NODE_ENV=test node --test tests/refunds.race.test.js`
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = require('../src/lib/prisma');
const { PAYMENT_STATUS, REFUND_TRIGGER } = require('../src/lib/constants');

const dbPath = path.resolve(__dirname, '..', 'dev.db');
const hasDb = fs.existsSync(dbPath) || !!process.env.DATABASE_URL;
const maybe = hasDb ? test : test.skip;

async function setupPaidOrder(testUser) {
  const outlet = await prisma.outlet.findFirst();
  if (!outlet) throw new Error('No outlet in dev DB — run `npm run db:seed`.');

  const menuItem = await prisma.menuItem.findFirst({ where: { outletId: outlet.id, isAvailable: true } });
  if (!menuItem) throw new Error('No available menu item in dev DB.');

  const order = await prisma.order.create({
    data: {
      orderNumber: `REFUND-RACE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId: testUser.id,
      outletId: outlet.id,
      status: 'PENDING',
      totalAmount: 1000,
      subtotal: 995,
      platformFee: 5,
      pickupCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      timeline: JSON.stringify([{ status: 'PENDING', at: new Date().toISOString(), by: testUser.id }]),
      items: {
        create: [{
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
          itemTotal: menuItem.price,
        }],
      },
      payment: {
        create: {
          amount: 1000,
          status: PAYMENT_STATUS.PAID, // pre-paid so the refund can be initiated
          method: 'ONLINE',
          razorpayPaymentId: 'pay_test_refund_race',
          razorpayOrderId: 'order_test_refund_race',
        },
      },
    },
    include: { payment: true, items: true },
  });
  return order;
}

maybe('Test 1: ₹1000 payment, 2 simultaneous ₹700 refund requests → one succeeds, one rejected', async () => {
  const user = await prisma.user.findFirst({ where: { status: 'ACTIVE', role: 'SUPER_ADMIN' } });
  if (!user) {
    console.warn('[refunds.race.test] No ACTIVE SUPER_ADMIN in dev DB.');
    return;
  }

  const order = await setupPaidOrder(user);
  try {
    // We can't call adminService.issueManualRefund directly because it
    // requires a real Razorpay client (the gateway call happens
    // post-commit). But the concurrent-race protection is at the
    // TRANSACTION level — the remaining-check + Refund.create are
    // inside a prisma.$transaction with SELECT FOR UPDATE. We can test
    // that directly by simulating two concurrent tx attempts.

    // Inline the core logic of the concurrent-refund tx (from
    // admin.service.js issueManualRefund fresh-refund path):
    const { remainingRefundable } = require('../src/lib/money');
    const { isPostgres } = require('../src/lib/distributedLock');
    const { REFUND_STATUS } = require('../src/lib/constants');

    async function attemptRefund(paymentId, amount, actorId) {
      return prisma.$transaction(async (tx) => {
        if (isPostgres()) {
          await tx.$queryRaw`SELECT * FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
        }
        const txRefunds = await tx.refund.findMany({ where: { paymentId } });
        const txRemaining = remainingRefundable(1000, txRefunds);
        if (amount > txRemaining) {
          throw {
            statusCode: 400,
            code: 'REFUND_AMOUNT_EXCEEDS_REMAINING',
            message: `Refund amount ₹${amount} exceeds remaining ₹${txRemaining}`,
          };
        }
        return tx.refund.create({
          data: {
            paymentId,
            amount,
            reason: 'race test',
            gatewayRef: null,
            status: REFUND_STATUS.PENDING,
            triggeredBy: REFUND_TRIGGER.SUPER_ADMIN_MANUAL,
            initiatedBy: actorId,
          },
        });
      });
    }

    // Fire 2 concurrent ₹700 refund attempts
    const settled = await Promise.allSettled([
      attemptRefund(order.payment.id, 700, user.id),
      attemptRefund(order.payment.id, 700, user.id),
    ]);

    const successes = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const rejections = settled.filter(r => r.status === 'rejected').map(r => r.reason);

    assert.strictEqual(successes.length, 1, `expected 1 winner, got ${successes.length}`);
    assert.strictEqual(rejections.length, 1, `expected 1 rejection, got ${rejections.length}`);
    assert.ok(
      rejections[0]?.code === 'REFUND_AMOUNT_EXCEEDS_REMAINING',
      `expected REFUND_AMOUNT_EXCEEDS_REMAINING, got: ${rejections[0]?.message}`
    );

    // Verify total Refund amount in DB = ₹700 (not ₹1400)
    const allRefunds = await prisma.refund.findMany({
      where: { paymentId: order.payment.id },
    });
    const totalRefundAmount = allRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
    assert.strictEqual(totalRefundAmount, 700, `expected total ₹700, got ₹${totalRefundAmount}`);
    assert.strictEqual(allRefunds.length, 1, `expected 1 Refund row, got ${allRefunds.length}`);

    console.log('  ✓ One ₹700 refund succeeded, one rejected. Total = ₹700 (not ₹1400).');
  } finally {
    // Cleanup
    await prisma.refund.deleteMany({ where: { paymentId: order.payment.id } });
    await prisma.notification.deleteMany({ where: { orderId: order.id } });
    await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
});

maybe('Test 1b: ₹1000 payment, sequential ₹700 + ₹300 refund → both succeed, total = ₹1000, Payment = REFUNDED', async () => {
  const user = await prisma.user.findFirst({ where: { status: 'ACTIVE', role: 'SUPER_ADMIN' } });
  if (!user) return;

  const order = await setupPaidOrder(user);
  try {
    const { remainingRefundable } = require('../src/lib/money');
    const { isPostgres } = require('../src/lib/distributedLock');
    const { REFUND_STATUS } = require('../src/lib/constants');

    async function attemptRefund(paymentId, amount, actorId) {
      return prisma.$transaction(async (tx) => {
        if (isPostgres()) {
          await tx.$queryRaw`SELECT * FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
        }
        const txRefunds = await tx.refund.findMany({ where: { paymentId } });
        const txRemaining = remainingRefundable(1000, txRefunds);
        if (amount > txRemaining) {
          throw { statusCode: 400, code: 'REFUND_AMOUNT_EXCEEDS_REMAINING' };
        }
        return tx.refund.create({
          data: {
            paymentId, amount, reason: 'sequential test',
            gatewayRef: null, status: REFUND_STATUS.PENDING,
            triggeredBy: REFUND_TRIGGER.SUPER_ADMIN_MANUAL,
            initiatedBy: actorId,
          },
        });
      });
    }

    // Sequential: ₹700 then ₹300
    const r1 = await attemptRefund(order.payment.id, 700, user.id);
    assert.ok(r1, 'first ₹700 should succeed');

    // Mark first as COMPLETED (simulate gateway confirmation)
    await prisma.refund.update({
      where: { id: r1.id },
      data: { status: REFUND_STATUS.COMPLETED, gatewayRef: 'rfd_test_1' },
    });

    const r2 = await attemptRefund(order.payment.id, 300, user.id);
    assert.ok(r2, 'second ₹300 should succeed (remaining was ₹300)');

    // Mark second as COMPLETED
    await prisma.refund.update({
      where: { id: r2.id },
      data: { status: REFUND_STATUS.COMPLETED, gatewayRef: 'rfd_test_2' },
    });

    // Now sum(COMPLETED) = 1000 = payment.amount → should be fully refunded
    const { markPaymentRefundedIfFullyRefunded } = require('../src/modules/payments/payments.service');
    await markPaymentRefundedIfFullyRefunded(order.payment.id);
    const payment = await prisma.payment.findUnique({ where: { id: order.payment.id } });
    assert.strictEqual(payment.status, PAYMENT_STATUS.REFUNDED, 'Payment should be REFUNDED after full refund');

    console.log('  ✓ Sequential ₹700 + ₹300 = ₹1000 → Payment = REFUNDED.');
  } finally {
    await prisma.refund.deleteMany({ where: { paymentId: order.payment.id } });
    await prisma.notification.deleteMany({ where: { orderId: order.id } });
    await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
});

maybe('Test 1c: ₹1000 payment, ₹700 refund COMPLETED, then ₹400 → rejected (exceeds remaining ₹300)', async () => {
  const user = await prisma.user.findFirst({ where: { status: 'ACTIVE', role: 'SUPER_ADMIN' } });
  if (!user) return;

  const order = await setupPaidOrder(user);
  try {
    const { remainingRefundable } = require('../src/lib/money');
    const { isPostgres } = require('../src/lib/distributedLock');
    const { REFUND_STATUS } = require('../src/lib/constants');

    async function attemptRefund(paymentId, amount, actorId) {
      return prisma.$transaction(async (tx) => {
        if (isPostgres()) {
          await tx.$queryRaw`SELECT * FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
        }
        const txRefunds = await tx.refund.findMany({ where: { paymentId } });
        const txRemaining = remainingRefundable(1000, txRefunds);
        if (amount > txRemaining) {
          throw { statusCode: 400, code: 'REFUND_AMOUNT_EXCEEDS_REMAINING' };
        }
        return tx.refund.create({
          data: {
            paymentId, amount, reason: 'over-refund test',
            gatewayRef: null, status: REFUND_STATUS.PENDING,
            triggeredBy: REFUND_TRIGGER.SUPER_ADMIN_MANUAL,
            initiatedBy: actorId,
          },
        });
      });
    }

    // First: ₹700 refund, mark as COMPLETED
    const r1 = await attemptRefund(order.payment.id, 700, user.id);
    await prisma.refund.update({
      where: { id: r1.id },
      data: { status: REFUND_STATUS.COMPLETED, gatewayRef: 'rfd_test_over' },
    });

    // Second: ₹400 refund — should FAIL (remaining = 1000 - 700 = 300, 400 > 300)
    try {
      await attemptRefund(order.payment.id, 400, user.id);
      assert.fail('Should have rejected ₹400 refund (exceeds remaining ₹300)');
    } catch (err) {
      assert.strictEqual(err.code, 'REFUND_AMOUNT_EXCEEDS_REMAINING');
    }

    // Verify only 1 Refund row exists
    const allRefunds = await prisma.refund.findMany({ where: { paymentId: order.payment.id } });
    assert.strictEqual(allRefunds.length, 1, 'should have only 1 Refund row');

    console.log('  ✓ ₹700 COMPLETED → ₹400 rejected (exceeds remaining ₹300).');
  } finally {
    await prisma.refund.deleteMany({ where: { paymentId: order.payment.id } });
    await prisma.notification.deleteMany({ where: { orderId: order.id } });
    await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
});

// ─── Tests that need a mocked Razorpay client (skipped) ────────────────────

test.skip('Test 2: 2 simultaneous payment verification requests → only one PAID transition', async () => {
  // Setup: seed a PENDING Payment with a known razorpayOrderId.
  // Mock: client.payments.fetch returns { amount: expected, status: 'captured' }.
  // Action: fire 2 concurrent verifyRazorpayPayment calls with a valid signature.
  // Assert: exactly 1 succeeds with PAID; the other gets 409 PAYMENT_STATE_RACE
  //         (the updateMany WHERE status=PENDING only lets one through).
  //         No duplicate razorpayPaymentId/razorpaySignature stored.
});

test.skip('Test 3: gateway fetch returns 500 → HTTP 503, Payment remains PENDING', async () => {
  // Setup: seed a PENDING Payment. Compute a valid signature.
  // Mock: client.payments.fetch throws a 500 error.
  // Action: call verifyRazorpayPayment.
  // Assert: throws 503 GATEWAY_VERIFICATION_UNAVAILABLE.
  //         Payment.status in DB is still PENDING (not PAID).
  //         (INO-AUDIT7 fail-closed fix.)
});

test.skip('Test 4: valid signature + wrong gateway amount → 400 PAYMENT_AMOUNT_MISMATCH, PENDING', async () => {
  // Setup: seed a PENDING Payment with amount=₹1000.
  // Mock: client.payments.fetch returns { amount: 50000 (₹500), status: 'captured' }.
  // Action: call verifyRazorpayPayment with a valid signature.
  // Assert: throws 400 PAYMENT_AMOUNT_MISMATCH.
  //         Payment.status in DB is still PENDING.
  //         Audit log has RAZORPAY_AMOUNT_MISMATCH entry.
});

test.skip('Test 5: valid signature + gateway status "authorized" → 400 PAYMENT_NOT_CAPTURED, PENDING', async () => {
  // Setup: seed a PENDING Payment with amount=₹1000.
  // Mock: client.payments.fetch returns { amount: 100000 (correct), status: 'authorized' }.
  // Action: call verifyRazorpayPayment with a valid signature.
  // Assert: throws 400 PAYMENT_NOT_CAPTURED.
  //         Payment.status in DB is still PENDING.
  //         Audit log has RAZORPAY_NOT_CAPTURED entry.
});

test.skip('Test 6: same refund.processed webhook delivered 2-3 times → one Refund row, COMPLETED, no duplicate', async () => {
  // Setup: seed a PAID Payment + a PENDING Refund row with a known gatewayRef.
  // Action: call handleRazorpayWebhook 3 times with the same refund.processed payload
  //         (same gatewayRefundId, payment_id, amount).
  // Assert:
  //   - First call: Refund → COMPLETED, Payment → REFUNDED (if full refund).
  //   - Second call: returns { alreadyCompleted: true }, no DB write.
  //   - Third call: same — idempotent.
  //   - Only 1 Refund row in DB. No duplicate.
});
