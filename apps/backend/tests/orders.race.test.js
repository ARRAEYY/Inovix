/**
 * INO-P2-37: order-side concurrency tests.
 *
 * Verifies the atomic-claim concurrency guarantee from the
 * transition.service.js refactor:
 *   - Two concurrent ACCEPTED requests for the same order → exactly one
 *     wins, the other gets 409 CONFLICT.
 *   - Two concurrent CANCELLED requests for the same order → exactly
 *     one wins, the other gets 409 CONFLICT.
 *   - READY timeout (cron) + manual COMPLETED simultaneously → exactly
 *     one wins. (This one is the trickiest — needs the cron to fire AND
 *     a manual request at the same time. Skipped as a scaffold.)
 *
 * The tests use the dev SQLite DB directly (same pattern as
 * tests/tokens.race.test.js + tests/auth.test.js). They skip gracefully
 * if the DB or seeded data isn't available.
 *
 * The new transition.service.js uses prisma.$transaction + an
 * updateMany WHERE status = expectedFromStatus as the atomic claim —
 * only one concurrent caller gets count === 1; the others see the
 * status has changed and throw 409 CONFLICT.
 *
 * Run via: `JWT_SECRET=test NODE_ENV=test node --test tests/orders.race.test.js`
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { performTransition } = require('../src/modules/orders/transition.service');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../src/lib/constants');
const prisma = require('../src/lib/prisma');

const dbPath = path.resolve(__dirname, '..', 'dev.db');
const hasDb = fs.existsSync(dbPath) || !!process.env.DATABASE_URL;
const maybe = hasDb ? test : test.skip;

async function pickTestOrder() {
  // Find an outlet-admin user with a seeded order at their outlet.
  // The seed (prisma/seed.js) creates a sample order — find one in
  // PENDING state, or any order whose status can transition.
  const order = await prisma.order.findFirst({
    where: { status: ORDER_STATUS.PENDING },
    include: { payment: true, outlet: true },
  });
  if (!order) throw new Error('No PENDING order in dev DB — run `npm run db:seed`.');
  return order;
}

async function setupPaidOrder(testUser) {
  // Create a fresh order + PENDING payment, then mark the payment PAID
  // so the transition service's payment guard allows ACCEPTED.
  // (In real life, the student goes through Razorpay; for tests we
  // short-circuit by setting Payment.status = PAID directly.)
  const outlet = await prisma.outlet.findFirst();
  if (!outlet) throw new Error('No outlet in dev DB — run `npm run db:seed`.');

  const menuItem = await prisma.menuItem.findFirst({ where: { outletId: outlet.id, isAvailable: true } });
  if (!menuItem) throw new Error('No available menu item in dev DB.');

  const order = await prisma.order.create({
    data: {
      orderNumber: `RACE-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId: testUser.id,
      outletId: outlet.id,
      status: ORDER_STATUS.PENDING,
      totalAmount: 100,
      subtotal: 95,
      platformFee: 5,
      pickupCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      timeline: JSON.stringify([{ status: ORDER_STATUS.PENDING, at: new Date().toISOString(), by: testUser.id }]),
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
          amount: 100,
          status: PAYMENT_STATUS.PAID, // short-circuit the payment guard
          method: 'ONLINE',
          razorpayPaymentId: 'pay_test_race',
          razorpayOrderId: 'order_test_race',
        },
      },
    },
    include: { payment: true, items: true },
  });
  return order;
}

maybe('INO-P2-37: order-side concurrency — exactly one ACCEPTED wins', async () => {
  const user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  if (!user) {
    console.warn('[orders.race.test] No ACTIVE user in dev DB. Run `npm run db:seed`.');
    return;
  }

  const order = await setupPaidOrder(user);
  try {
    // Fire N concurrent ACCEPTED transitions for the same order.
    const N = 10;
    const settled = await Promise.allSettled(
      Array.from({ length: N }, () =>
        performTransition({
          orderId: order.id,
          expectedFromStatus: ORDER_STATUS.PENDING,
          toStatus: ORDER_STATUS.ACCEPTED,
          actorId: user.id,
          reason: 'race test',
        })
      )
    );

    const successes = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const rejections = settled.filter(r => r.status === 'rejected');

    assert.strictEqual(
      successes.length,
      1,
      `expected exactly 1 winner out of ${N} concurrent ACCEPTED, got ${successes.length}`
    );

    // The other 9 should reject with statusCode 409 (CONFLICT) — the
    // atomic claim via updateMany WHERE status = PENDING ensures only
    // one count === 1.
    assert.strictEqual(
      rejections.length,
      N - 1,
      `expected ${N - 1} rejections, got ${rejections.length}`
    );
    for (const r of rejections) {
      assert.ok(
        r.reason?.statusCode === 409 || r.reason?.code === 'CONFLICT',
        `expected 409 CONFLICT, got: ${r.reason?.message || r.reason}`
      );
    }

    // Verify the order is now ACCEPTED.
    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.strictEqual(finalOrder.status, ORDER_STATUS.ACCEPTED);

    // Verify exactly ONE audit log entry was written (the winner's).
    const auditCount = await prisma.auditLog.count({
      where: { targetType: 'Order', targetId: order.id, action: 'ORDER_STATUS_CHANGED' },
    });
    assert.strictEqual(auditCount, 1, `expected 1 audit entry, got ${auditCount}`);

    // Verify exactly ONE notification was written (the winner's).
    const notifCount = await prisma.notification.count({
      where: { orderId: order.id, type: 'ORDER_ACCEPTED' },
    });
    assert.strictEqual(notifCount, 1, `expected 1 notification, got ${notifCount}`);
  } finally {
    // Cleanup — delete the test order + its cascade children.
    await prisma.notification.deleteMany({ where: { orderId: order.id } });
    await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.refund.deleteMany({ where: { payment: { orderId: order.id } } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
});

maybe('INO-P2-37: order-side concurrency — exactly one CANCELLED wins', async () => {
  const user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  if (!user) return;

  const order = await setupPaidOrder(user);
  try {
    // Fire N concurrent CANCELLED transitions (simulating outlet-cancel
    // racing with student-cancel, which is a real scenario).
    const N = 10;
    const settled = await Promise.allSettled(
      Array.from({ length: N }, () =>
        performTransition({
          orderId: order.id,
          expectedFromStatus: ORDER_STATUS.PENDING,
          toStatus: ORDER_STATUS.CANCELLED,
          actorId: user.id,
          reason: 'race cancel test',
        })
      )
    );

    const successes = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const rejections = settled.filter(r => r.status === 'rejected');

    assert.strictEqual(successes.length, 1, `expected 1 winner, got ${successes.length}`);
    assert.strictEqual(rejections.length, N - 1, `expected ${N - 1} rejections, got ${rejections.length}`);

    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    assert.strictEqual(finalOrder.status, ORDER_STATUS.CANCELLED);

    // Verify exactly one audit log entry.
    const auditCount = await prisma.auditLog.count({
      where: { targetType: 'Order', targetId: order.id, action: 'ORDER_STATUS_CHANGED' },
    });
    assert.strictEqual(auditCount, 1, `expected 1 audit entry, got ${auditCount}`);

    // The winner should have created a Refund row with status=PENDING
    // (PENDING → CANCELLED triggers OUTLET_CANCEL refund). The other 9
    // losers don't create Refund rows because their txns rolled back.
    const refundCount = await prisma.refund.count({
      where: { payment: { orderId: order.id } },
    });
    assert.strictEqual(refundCount, 1, `expected 1 refund row, got ${refundCount}`);
  } finally {
    await prisma.notification.deleteMany({ where: { orderId: order.id } });
    await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.refund.deleteMany({ where: { payment: { orderId: order.id } } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
});

maybe('INO-P2-37: sequential transition after a failed concurrent claim', async () => {
  // After a 409, the client should be able to re-read the order and
  // attempt the transition from the NEW status. This verifies the
  // transition service's error path doesn't leave the order in a
  // weird intermediate state.
  const user = await prisma.user.findFirst({ where: { status: 'ACTIVE' } });
  if (!user) return;

  const order = await setupPaidOrder(user);
  try {
    // Two concurrent ACCEPTED — exactly one wins.
    const [a, b] = await Promise.allSettled([
      performTransition({ orderId: order.id, expectedFromStatus: ORDER_STATUS.PENDING, toStatus: ORDER_STATUS.ACCEPTED, actorId: user.id }),
      performTransition({ orderId: order.id, expectedFromStatus: ORDER_STATUS.PENDING, toStatus: ORDER_STATUS.ACCEPTED, actorId: user.id }),
    ]);
    assert.strictEqual(a.status === 'fulfilled' ? 1 : 0, 1, 'a should be fulfilled or rejected exactly');
    assert.strictEqual(b.status === 'fulfilled' ? 1 : 0, 0, 'b should be the loser (rejected)');
    const winner = a.status === 'fulfilled' ? a.value : b.value;
    const loser = a.status === 'rejected' ? a.reason : b.reason;

    assert.ok(loser?.statusCode === 409 || loser?.code === 'CONFLICT');

    // Now the loser (or any client) should be able to do the NEXT
    // transition: ACCEPTED → PREPARING. This is the recovery path.
    const next = await performTransition({
      orderId: order.id,
      expectedFromStatus: ORDER_STATUS.ACCEPTED,
      toStatus: ORDER_STATUS.PREPARING,
      actorId: user.id,
    });
    assert.strictEqual(next.updated.status, ORDER_STATUS.PREPARING);
    assert.strictEqual(next.before.status, ORDER_STATUS.ACCEPTED);
  } finally {
    await prisma.notification.deleteMany({ where: { orderId: order.id } });
    await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.refund.deleteMany({ where: { payment: { orderId: order.id } } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
});

// ─── Skipped: READY timeout + manual COMPLETED simultaneously ────────────────
//
// This is the trickiest concurrency scenario: the cron-based pickup
// timeout (lib/cron.js processPickupTimeouts) races with a manual
// PATCH /api/v1/outlet/orders/:id/status { status: COMPLETED } from
// the outlet dashboard. Both attempt to transition the order from
// READY to a terminal state (CANCELLED vs COMPLETED).
//
// To test this properly, you'd need:
//   1. A seeded order in READY state with readyAt older than
//      pickupTimeoutMins
//   2. A way to trigger processPickupTimeouts() AND a manual
//      performTransition({ toStatus: COMPLETED }) at the same instant
//   3. Assert exactly one wins, the other gets 409 CONFLICT
//
// The hard part is synchronizing the two — Promise.all() doesn't
// guarantee simultaneous execution. A real test would use a barrier
// or a mock clock. Out of scope for this commit; flagged as TODO.
test.skip('INO-P2-37: READY timeout (cron) + manual COMPLETED race — exactly one wins', async () => {
  // See comment above.
});
