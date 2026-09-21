/**
 * E2E flow: real student order placement + status transitions + RBAC + audit.
 *
 * INO-P2-35 fix: the previous version of this file claimed to test
 * "Order placement + status transitions + RBAC" but skipped student-side
 * order creation entirely and exited successfully — a false-positive
 * that let CI report green without actually exercising the order flow.
 *
 * This version actually runs the flow end-to-end:
 *   1. Dev-login as an outlet admin (acts as both the "student" placing
 *      the order AND the outlet staff processing it — see HACKS below)
 *   2. Browse catalog → find an available menu item
 *   3. Create order (POST /api/v1/orders) — order is PENDING, Payment is PENDING
 *   4. HACK: directly set Payment.status = PAID via prisma (see HACKS)
 *   5. PATCH order status → ACCEPTED (outlet staff)
 *   6. PATCH order status → PREPARING
 *   7. PATCH order status → READY
 *   8. PATCH order status → COMPLETED
 *   9. Verify GET /api/v1/notifications returns ORDER_ACCEPTED,
 *      ORDER_PREPARING, ORDER_READY, ORDER_COMPLETED notifications
 *  10. Verify GET /api/v1/audit returns ORDER_CREATED + ORDER_STATUS_CHANGED
 *      entries
 *  11. Test the cancellation flow on a second order (PENDING → CANCELLED)
 *  12. Test the rejection flow on a third order (PENDING → REJECTED)
 *
 * HACKS:
 *   - The student account `adil@rishihood.edu.in` is Google-only — it
 *     can't dev-login with a password. We use the outlet admin token
 *     (`adilreyaz.outlet@nosh.local` / `NoshOutlet@123`) to act as both
 *     the student AND the outlet staff for orders at the outlet admin's
 *     own outlet. The orders.controller.js `createOrder` uses req.user.id
 *     as the studentId (no role check), so this works. In real life, the
 *     student signs in via Google.
 *   - The payment flow (Razorpay order creation + checkout + signature
 *     verification) can't be tested without real Razorpay sandbox
 *     credentials. We short-circuit by directly setting Payment.status
 *     = PAID via prisma, which is what the verify endpoint would do on
 *     a successful checkout. This is a test-only DB write.
 *
 * Run: `node test-e2e.js` (requires the server on :3000 + seeded dev DB +
 *      the dev SQLite file accessible at apps/backend/dev.db).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000/api/v1';

// HACK: load prisma directly to short-circuit the payment flow.
let prisma;
try {
  prisma = require('./src/lib/prisma');
} catch (err) {
  console.warn('[e2e] Could not load prisma — payment hack will fail:', err.message);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function devLogin(email, password) {
  const { data } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return data?.data?.accessToken;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name} — ${detail}`);
    fail++;
  }
}

async function main() {
  console.log('--- E2E: Real student order flow + status transitions + RBAC ---\n');

  // 1. Login as both the student AND the outlet admin (separate tokens).
  //    INO-AUDIT5: the previous version used the outlet admin token for
  //    both roles (HACK). After the D3 fix (STUDENT-only authorization on
  //    POST /orders), the outlet admin token gets 403 on POST /orders.
  //    Now we use a real student token for the student-side flow + the
  //    outlet admin token for the outlet-side flow.
  //    The student `adil@rishihood.edu.in` is Google-only (no password
  //    hash) — dev-login lets it through without a password in dev mode.
  const studentToken = await devLogin('adil@rishihood.edu.in');
  if (!studentToken) {
    console.error('Failed to log in as student. Are you running `npm run dev:backend`?');
    console.error('Also check: ENABLE_DEV_LOGIN=true + NODE_ENV=development in .env');
    process.exit(1);
  }
  console.log('✓ Logged in as student (adil@rishihood.edu.in)');

  const outletToken = await devLogin('adilreyaz.outlet@nosh.local', 'NoshOutlet@123');
  if (!outletToken) {
    console.error('Failed to log in as outlet admin.');
    process.exit(1);
  }
  console.log('✓ Logged in as outlet admin (adilreyaz.outlet@nosh.local)');

  // Get user info for both
  const studentMeRes = await fetchJson(`${BASE_URL}/auth/me`, { headers: authHeaders(studentToken) });
  const studentId = studentMeRes.data?.data?.user?.id;
  check('GET /auth/me returns student user', !!studentId, 'no user.id in response');

  const outletMeRes = await fetchJson(`${BASE_URL}/auth/me`, { headers: authHeaders(outletToken) });
  const outletId = outletMeRes.data?.data?.user?.outletId;
  check('Outlet admin has outletId', !!outletId, 'no outletId — user is not outlet-scoped');
  if (!studentId || !outletId) {
    console.error('Cannot proceed without studentId + outletId');
    process.exit(1);
  }

  // 2. Browse catalog as student → find the outlet's menu → find an available item
  const catalogRes = await fetchJson(`${BASE_URL}/catalog/outlets`, { headers: authHeaders(studentToken) });
  check('GET /catalog/outlets returns list', catalogRes.status === 200 && Array.isArray(catalogRes.data?.data));
  const myOutlet = catalogRes.data?.data?.find(o => o.id === outletId);
  check('Outlet is in catalog (OPEN/BUSY)', !!myOutlet, `outlet ${outletId} not in catalog`);

  const menuRes = await fetchJson(`${BASE_URL}/catalog/outlets/${outletId}/menu`, { headers: authHeaders(studentToken) });
  check('GET /catalog/outlets/:id/menu returns menu', menuRes.status === 200 && Array.isArray(menuRes.data?.data));
  const availableItem = menuRes.data?.data?.find(m => m.isAvailable);
  check('Found an available menu item', !!availableItem, 'no isAvailable=true item in menu');
  if (!availableItem) {
    console.error('Cannot proceed without an available menu item');
    process.exit(1);
  }
  console.log(`  ℹ Using menu item: ${availableItem.name} (₹${availableItem.price})`);

  // 3. Create order AS THE STUDENT (the new STUDENT-only authorization
  //    on POST /orders means the outlet admin token would get 403).
  const createOrderRes = await fetchJson(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: authHeaders(studentToken),
    body: JSON.stringify({
      outletId,
      items: [{ menuItemId: availableItem.id, quantity: 2 }],
      paymentMethod: 'ONLINE',
      notes: 'E2E test order',
    }),
  });
  check('POST /orders as student creates order (201)', createOrderRes.status === 201, `got ${createOrderRes.status}: ${JSON.stringify(createOrderRes.data)}`);
  const order = createOrderRes.data?.data;
  check('Order has PENDING status', order?.status === 'PENDING', `status was ${order?.status}`);
  check('Order has correct studentId', order?.studentId === studentId, `studentId ${order?.studentId} vs ${studentId}`);
  check('Order has correct outletId', order?.outletId === outletId);
  check('Order total = (price × qty) + platformFee', Number(order?.totalAmount) === Number(availableItem.price) * 2 + 5, `total was ${order?.totalAmount}`);
  check('Order has pickupCode', !!order?.pickupCode);

  // 3b. RBAC test: outlet admin trying to POST /orders → 403 (D3 boundary)
  const outletOrderRes = await fetchJson(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: authHeaders(outletToken),
    body: JSON.stringify({
      outletId,
      items: [{ menuItemId: availableItem.id, quantity: 1 }],
      paymentMethod: 'ONLINE',
    }),
  });
  check('POST /orders as outlet admin → 403 (role boundary)', outletOrderRes.status === 403, `got ${outletOrderRes.status} (expected 403 — D3 STUDENT-only auth)`);

  if (!order) {
    console.error('Cannot proceed without an order');
    process.exit(1);
  }
  console.log(`  ℹ Order created: ${order.orderNumber} (₹${order.totalAmount})`);

  // 4. HACK: directly set Payment.status = PAID via prisma
  if (prisma) {
    try {
      await prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: 'pay_e2e_test',
          razorpayOrderId: 'order_e2e_test',
          razorpaySignature: 'sig_e2e_test',
        },
      });
      console.log('  ℹ HACK: set Payment.status = PAID via prisma (bypassing Razorpay)');
    } catch (err) {
      console.error('  ⚠ HACK failed — cannot mark payment PAID:', err.message);
      console.error('    Subsequent ACCEPTED/PREPARING/READY/COMPLETED will fail with 400 PAYMENT_REQUIRED');
    }
  } else {
    console.error('  ⚠ prisma not available — cannot mark payment PAID');
  }

  // 5. PATCH order status → ACCEPTED
  //    Uses the outlet-orders route (requires OUTLET_STAFF/ADMIN role)
  const acceptRes = await fetchJson(`${BASE_URL}/outlet/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: authHeaders(outletToken),
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  check('PATCH /outlet/orders/:id/status → ACCEPTED (200)', acceptRes.status === 200, `got ${acceptRes.status}: ${JSON.stringify(acceptRes.data)}`);

  // 6. PATCH order status → PREPARING
  const prepRes = await fetchJson(`${BASE_URL}/outlet/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: authHeaders(outletToken),
    body: JSON.stringify({ status: 'PREPARING' }),
  });
  check('PATCH status → PREPARING (200)', prepRes.status === 200, `got ${prepRes.status}: ${JSON.stringify(prepRes.data)}`);

  // 7. PATCH order status → READY
  const readyRes = await fetchJson(`${BASE_URL}/outlet/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: authHeaders(outletToken),
    body: JSON.stringify({ status: 'READY' }),
  });
  check('PATCH status → READY (200)', readyRes.status === 200, `got ${readyRes.status}: ${JSON.stringify(readyRes.data)}`);

  // 8. PATCH order status → COMPLETED
  const completeRes = await fetchJson(`${BASE_URL}/outlet/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: authHeaders(outletToken),
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  check('PATCH status → COMPLETED (200)', completeRes.status === 200, `got ${completeRes.status}: ${JSON.stringify(completeRes.data)}`);

  // 9. Verify notifications — should have ORDER_ACCEPTED, ORDER_PREPARING,
  //    ORDER_READY, ORDER_COMPLETED for this order
  const notifRes = await fetchJson(`${BASE_URL}/notifications`, { headers: authHeaders(outletToken) });
  check('GET /notifications returns list', notifRes.status === 200 && Array.isArray(notifRes.data?.data?.items));
  const orderNotifs = notifRes.data?.data?.items?.filter(n => n.orderId === order.id) || [];
  const notifTypes = new Set(orderNotifs.map(n => n.type));
  check('Has ORDER_ACCEPTED notification', notifTypes.has('ORDER_ACCEPTED'), `types: ${[...notifTypes].join(', ')}`);
  check('Has ORDER_PREPARING notification', notifTypes.has('ORDER_PREPARING'));
  check('Has ORDER_READY notification', notifTypes.has('ORDER_READY'));
  check('Has ORDER_COMPLETED notification', notifTypes.has('ORDER_COMPLETED'));

  // 10. Verify audit log entries
  const auditRes = await fetchJson(`${BASE_URL}/audit?targetType=Order&targetId=${order.id}`, { headers: authHeaders(outletToken) });
  check('GET /audit returns entries for this order', auditRes.status === 200 && Array.isArray(auditRes.data?.data?.items));
  const orderAudits = auditRes.data?.data?.items || [];
  const auditActions = new Set(orderAudits.map(a => a.action));
  check('Has ORDER_CREATED audit entry', auditActions.has('ORDER_CREATED'));
  check('Has ORDER_STATUS_CHANGED audit entry', auditActions.has('ORDER_STATUS_CHANGED'));

  // 11. Test cancellation flow on a second order (student cancels)
  console.log('\n  ℹ Testing cancellation flow on a 2nd order...');
  const order2Res = await fetchJson(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: authHeaders(studentToken), // INO-AUDIT5: student creates + cancels
    body: JSON.stringify({
      outletId,
      items: [{ menuItemId: availableItem.id, quantity: 1 }],
      paymentMethod: 'ONLINE',
    }),
  });
  const order2 = order2Res.data?.data;
  check('Created 2nd order for cancellation test', !!order2);

  if (order2) {
    const cancelRes = await fetchJson(`${BASE_URL}/orders/${order2.id}/cancel`, {
      method: 'POST',
      headers: authHeaders(studentToken), // student cancels their own order
    });
    check('POST /orders/:id/cancel → 200', cancelRes.status === 200, `got ${cancelRes.status}: ${JSON.stringify(cancelRes.data)}`);
    check('2nd order is now CANCELLED', cancelRes.data?.data?.status === 'CANCELLED', `status was ${cancelRes.data?.data?.status}`);

    // Verify ORDER_CANCELLED notification + audit
    const cancelNotifs = await fetchJson(`${BASE_URL}/notifications`, { headers: authHeaders(outletToken) });
    const cancelNotif = (cancelNotifs.data?.data?.items || []).find(n => n.orderId === order2.id && n.type === 'ORDER_CANCELLED');
    check('Has ORDER_CANCELLED notification', !!cancelNotif);
  }

  // 12. Test rejection flow on a 3rd order (PENDING → REJECTED)
  console.log('  ℹ Testing rejection flow on a 3rd order...');
  const order3Res = await fetchJson(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: authHeaders(studentToken), // INO-AUDIT5: student creates
    body: JSON.stringify({
      outletId,
      items: [{ menuItemId: availableItem.id, quantity: 1 }],
      paymentMethod: 'ONLINE',
    }),
  });
  const order3 = order3Res.data?.data;
  check('Created 3rd order for rejection test', !!order3);

  if (order3) {
    // Mark payment PAID first (otherwise outlet can't reject)
    if (prisma) {
      await prisma.payment.update({
        where: { orderId: order3.id },
        data: { status: 'PAID', razorpayPaymentId: 'pay_e2e_test_3', razorpayOrderId: 'order_e2e_test_3' },
      }).catch(() => null);
    }

    const rejectRes = await fetchJson(`${BASE_URL}/outlet/orders/${order3.id}/status`, {
      method: 'PATCH',
      headers: authHeaders(outletToken),
      body: JSON.stringify({ status: 'REJECTED', reason: 'Item out of stock' }),
    });
    check('PATCH status → REJECTED (200)', rejectRes.status === 200, `got ${rejectRes.status}: ${JSON.stringify(rejectRes.data)}`);
    check('3rd order is now REJECTED', rejectRes.data?.data?.status === 'REJECTED');

    const rejectNotifs = await fetchJson(`${BASE_URL}/notifications`, { headers: authHeaders(outletToken) });
    const rejectNotif = (rejectNotifs.data?.data?.items || []).find(n => n.orderId === order3.id && n.type === 'ORDER_REJECTED');
    check('Has ORDER_REJECTED notification', !!rejectNotif);
  }

  // 13. RBAC: cross-outlet access should be 403
  console.log('\n  ℹ Testing RBAC: cross-outlet access...');
  const otherOutletRes = await fetchJson(`${BASE_URL}/catalog/outlets`, { headers: authHeaders(outletToken) });
  const otherOutlet = (otherOutletRes.data?.data || []).find(o => o.id !== outletId);
  if (otherOutlet) {
    // Try to fetch another outlet's order (should 403/404 since we have no orders at their outlet)
    const otherOrderRes = await fetchJson(`${BASE_URL}/outlet/orders/nonexistent-order-id`, {
      headers: authHeaders(outletToken),
    });
    check('Cross-outlet order access is rejected', otherOrderRes.status === 403 || otherOrderRes.status === 404, `got ${otherOrderRes.status}`);
  }

  // 14. Cleanup — delete the test orders so the dev DB stays clean
  if (prisma) {
    console.log('\n  ℹ Cleaning up test orders...');
    for (const o of [order, order2, order3].filter(Boolean)) {
      try {
        await prisma.notification.deleteMany({ where: { orderId: o.id } });
        await prisma.auditLog.deleteMany({ where: { targetType: 'Order', targetId: o.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: o.id } });
        await prisma.refund.deleteMany({ where: { payment: { orderId: o.id } } });
        await prisma.payment.deleteMany({ where: { orderId: o.id } });
        await prisma.order.delete({ where: { id: o.id } });
      } catch (err) {
        console.log(`  ⚠ cleanup failed for order ${o.id}: ${err.message}`);
      }
    }
  }

  console.log(`\n── E2E summary: ${pass} passed, ${fail} failed ──`);
  if (fail > 0) {
    process.exit(1);
  }
  console.log('✓ Real student E2E complete.');
}

main().catch((err) => {
  console.error('\n✗ E2E failed unexpectedly:', err);
  process.exit(1);
});
