/**
 * Payment service — Razorpay per-outlet integration.
 *
 * Spec ref: §1.2 payment model — "Each outlet owns and operates its own
 * Razorpay account. The platform never touches money. When a student pays
 * for an order at outlet X, the backend uses outlet X's stored Razorpay
 * credentials (encrypted) to create the order, verify the signature, and
 * process webhooks/refunds."
 *
 * V1 implementation:
 *   - Per-outlet Razorpay key/secret/webhook-secret stored encrypted
 *     (AES-256-GCM via src/lib/crypto.js) in the Outlet table.
 *   - The backend lazily instantiates a Razorpay client per outlet.
 *   - Payment flow:
 *       1. POST /payments/razorpay/order  → creates Razorpay Order at gateway
 *       2. Frontend shows Razorpay checkout
 *       3. POST /payments/razorpay/verify → verifies signature, marks Payment.PAID
 *       4. Razorpay webhook → backup verification path
 *   - Refunds:
 *       - Outlet rejects pre-ACCEPTED  → full auto-refund (OUTLET_REJECT)
 *       - Outlet cancels pre-READY     → full auto-refund (OUTLET_CANCEL)
 *       - Super-admin manual           → manual via Razorpay dashboard + DB record
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const { encrypt, decrypt, safeEqual } = require('../../lib/crypto');
const { PAYMENT_STATUS, REFUND_TRIGGER, REFUND_TRIGGERS, REFUND_STATUS } = require('../../lib/constants');
const { audit } = require('../../lib/audit');
const { toPaise, isFullyRefunded } = require('../../lib/money');

// ─── Razorpay client cache (one per outlet, keyed by outletId) ──────────────
const clientCache = new Map();

// ─── INO-AUDIT4-D2 helper: only mark Payment=REFUNDED if fully refunded ────
// The previous implementation unconditionally set Payment.status = REFUNDED
// whenever a single Refund row reached COMPLETED. That's wrong for partial
// refunds: a ₹1000 payment with a ₹300 COMPLETED refund should stay PAID
// (with ₹700 still refundable), not flip to REFUNDED.
//
// Correct invariant:
//   sum(COMPLETED refunds) == payment.amount → REFUNDED (full refund)
//   sum(COMPLETED refunds) <  payment.amount → PAID (partial refund or none)
//   PENDING refunds are in-flight money, NOT counted toward "fully refunded"
//
// INO-AUDIT5-D28 fix: use integer paise (toPaise from lib/money.js) instead
// of Number() + epsilon. The previous implementation used floating-point
// arithmetic + a 0.01 epsilon for safety, which defeated the purpose of
// the centralized money helpers. Now both sides convert to paise (integer)
// and compare exactly — no epsilon required.
async function markPaymentRefundedIfFullyRefunded(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { refunds: true },
  });
  if (!payment) return null;

  // INO-AUDIT5-D28: use the centralized isFullyRefunded helper from
  // lib/money.js — integer paise comparison, no floating-point, no epsilon.
  const fullyRefunded = isFullyRefunded(payment.amount, payment.refunds);

  if (fullyRefunded && payment.status !== PAYMENT_STATUS.REFUNDED) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: PAYMENT_STATUS.REFUNDED },
    });
  }
  // If NOT fully refunded, ensure Payment is NOT marked REFUNDED.
  // (Defensive — shouldn't happen given the new logic, but if an old
  // row was incorrectly marked REFUNDED, this corrects it on the next
  // refund event.)
  if (!fullyRefunded && payment.status === PAYMENT_STATUS.REFUNDED) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: PAYMENT_STATUS.PAID },
    });
  }
  return payment;
}

async function getOutletRazorpayClient(outletId) {
  if (clientCache.has(outletId)) return clientCache.get(outletId);

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw { statusCode: 404, message: 'Outlet not found' };
  if (!outlet.razorpayKeyIdEnc || !outlet.razorpayKeySecretEnc) {
    throw {
      statusCode: 400,
      code: 'PAYMENT_NOT_CONFIGURED',
      message: 'Outlet has not configured Razorpay credentials. Super admin must set them via /api/v1/admin/outlets/:id/razorpay-credentials.',
    };
  }
  const keyId = decrypt(outlet.razorpayKeyIdEnc);
  const keySecret = decrypt(outlet.razorpayKeySecretEnc);
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  clientCache.set(outletId, client);
  return client;
}

/**
 * Store encrypted Razorpay credentials for an outlet. Super-admin only.
 */
async function setOutletRazorpayCredentials(outletId, { keyId, keySecret, webhookSecret }) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw { statusCode: 404, message: 'Outlet not found' };

  await prisma.outlet.update({
    where: { id: outletId },
    data: {
      razorpayKeyIdEnc: encrypt(keyId),
      razorpayKeySecretEnc: encrypt(keySecret),
      razorpayWebhookSecretEnc: encrypt(webhookSecret),
    },
  });
  clientCache.delete(outletId);
  return true;
}

/**
 * Create a Razorpay Order at the gateway for the given internal Order.
 * The student's frontend uses this gateway order id to invoke the
 * Razorpay checkout flow.
 *
 * INO-P0-6 fix: idempotent — if the Payment row already has a
 * `razorpayOrderId` and is still PENDING, return the existing gateway
 * order info instead of creating a new one.
 *
 * INO-AUDIT6-#2 fix: atomic claim — the previous implementation had a
 * TOCTOU race: two concurrent requests both read razorpayOrderId=NULL,
 * both call client.orders.create(), both update. The second update
 * overwrites the first's gateway order, leaving the first orphaned at
 * the gateway. Fix: atomically claim the Payment row with a sentinel
 * ("in-progress-...") before calling the gateway. Only the request
 * whose updateMany count === 1 proceeds; the other re-reads + returns
 * 409 GATEWAY_ORDER_IN_FLIGHT. On gateway failure, the sentinel is
 * reset to NULL so the next request can retry.
 */
async function createRazorpayOrder(orderId, actorId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, outlet: true },
  });
  if (!order) throw { statusCode: 404, message: 'Order not found' };

  // Only the student who placed the order may init payment
  if (order.studentId !== actorId) {
    throw { statusCode: 403, message: 'Not your order' };
  }

  if (order.payment?.status === PAYMENT_STATUS.PAID) {
    throw { statusCode: 409, message: 'Order is already paid' };
  }

  // INO-AUDIT6-#4: use the centralized money helper, not Math.round(Number(x)*100)
  const amountPaise = toPaise(order.totalAmount);
  const keyId = decrypt(order.outlet.razorpayKeyIdEnc);

  // Idempotent: if we already have a REAL gateway order id and the payment
  // is still PENDING (not yet verified), reuse it.
  if (
    order.payment?.razorpayOrderId &&
    !order.payment.razorpayOrderId.startsWith('in-progress-') &&
    order.payment?.status === PAYMENT_STATUS.PENDING
  ) {
    return {
      razorpayOrderId: order.payment.razorpayOrderId,
      amount: amountPaise,
      currency: 'INR',
      keyId,
    };
  }

  // INO-AUDIT6-#2: atomic claim — set a sentinel so concurrent requests
  // can't both create gateway orders. The sentinel "in-progress-..." is
  // recognizable in the DB + reconciliation worker.
  const claimSentinel = `in-progress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const claimed = await prisma.payment.updateMany({
    where: {
      id: order.payment.id,
      razorpayOrderId: null,
    },
    data: { razorpayOrderId: claimSentinel },
  });

  if (claimed.count !== 1) {
    // Another request already set razorpayOrderId — either a real one
    // (just finished) or another sentinel (in-flight). Re-read to decide.
    const current = await prisma.payment.findUnique({ where: { id: order.payment.id } });
    if (current?.razorpayOrderId && !current.razorpayOrderId.startsWith('in-progress-')) {
      // A real gateway order ID was set by another request — return it.
      return {
        razorpayOrderId: current.razorpayOrderId,
        amount: amountPaise,
        currency: 'INR',
        keyId,
      };
    }
    // Another request is in-flight (sentinel set) — return 409.
    throw {
      statusCode: 409,
      code: 'GATEWAY_ORDER_IN_FLIGHT',
      message: 'Another gateway order creation is in progress. Please retry.',
    };
  }

  // We've claimed the row — now call the gateway.
  // INO-AUDIT8-#2 fix: client acquisition is INSIDE the try block so
  // that a getOutletRazorpayClient() failure also resets the sentinel.
  // The previous implementation had it outside — if the client-acquisition
  // threw, the function exited and the sentinel stayed forever.
  try {
    const client = await getOutletRazorpayClient(order.outletId);

    // Razorpay expects amount in paise (1 INR = 100 paise)
    const gatewayOrder = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: {
        orderId: order.id,
        outletId: order.outletId,
        studentId: order.studentId,
      },
    });

    // Persist the real gateway order ID (replacing the sentinel).
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        gatewayRef: gatewayOrder.id,
        razorpayOrderId: gatewayOrder.id,
        method: 'ONLINE',
      },
    });

    await audit({
      actorId,
      action: 'RAZORPAY_ORDER_CREATED',
      targetType: 'Payment',
      targetId: order.payment.id,
      after: { gatewayRef: gatewayOrder.id, amount: order.totalAmount },
    });

    return {
      razorpayOrderId: gatewayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      keyId,
    };
  } catch (err) {
    // Gateway call failed — reset the sentinel so the next request can retry.
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { razorpayOrderId: null },
    }).catch(() => null);
    throw err;
  }
}

/**
 * Verify the Razorpay payment signature after checkout.
 *
 * Razorpay sends:
 *   - razorpay_order_id
 *   - razorpay_payment_id
 *   - razorpay_signature = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 *
 * We recompute the HMAC with the outlet's stored key_secret and compare
 * in constant time to prevent timing attacks.
 */
async function verifyRazorpayPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }, actorId) {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
    include: { order: { include: { outlet: true } } },
  });
  if (!payment) throw { statusCode: 404, message: 'Payment not found for this gateway order' };

  // ─── INO-002 fix: authorization ──────────────────────────────────────────
  // createRazorpayOrder() explicitly verifies `order.studentId === actorId`
  // before minting the gateway order. The verify path was missing the same
  // check, so a different authenticated student could call /verify with
  // another student's razorpayOrderId. The Razorpay signature still
  // prevents arbitrary payments, but we must enforce resource ownership
  // at the API layer too.
  if (payment.order.studentId !== actorId) {
    throw { statusCode: 403, message: 'Not your payment' };
  }

  // ─── INO-003 fix: idempotency + explicit state transition ────────────────
  // The webhook path returns `{ alreadyPaid: true }` when the Payment is
  // already PAID; the verify path was unconditionally calling
  // prisma.payment.update(... status: PAID), which:
  //   1. Re-emits the `order:new` socket event (duplicate notification)
  //   2. Overwrites razorpaySignature/razorpayPaymentId on a REFUNDED
  //      payment, leaving inconsistent state.
  // Fix: allow PENDING → PAID only; idempotently return on already-PAID;
  // reject any other transition (REFUNDED, FAILED).
  if (payment.status === PAYMENT_STATUS.PAID) {
    return { ...payment, idempotent: true };
  }
  if (payment.status !== PAYMENT_STATUS.PENDING) {
    throw {
      statusCode: 409,
      code: 'INVALID_PAYMENT_STATE',
      message: `Payment is in state ${payment.status}; cannot mark as PAID`,
    };
  }

  const outlet = payment.order.outlet;
  // INO-P0-4 fix: the checkout signature is HMAC-SHA256 keyed by the outlet's
  // API *key secret* (razorpayKeySecretEnc). The webhook secret
  // (razorpayWebhookSecretEnc) is a separate credential used only to verify
  // the webhook path. The previous check required BOTH, which meant an
  // outlet with a valid API key/secret but no webhook secret configured
  // would fail the normal /razorpay/verify checkout path — the student
  // couldn't complete payment even though the gateway side was fine.
  if (!outlet.razorpayKeySecretEnc) {
    throw { statusCode: 400, message: 'Outlet Razorpay API key/secret not configured' };
  }
  const keySecret = decrypt(outlet.razorpayKeySecretEnc);

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (!safeEqual(expected, razorpaySignature)) {
    await audit({
      actorId,
      action: 'RAZORPAY_SIGNATURE_INVALID',
      targetType: 'Payment',
      targetId: payment.id,
      req: null,
    });
    throw { statusCode: 400, code: 'PAYMENT_FAILED', message: 'Invalid payment signature' };
  }

  // ─── INO-AUDIT4-D5 + D25 fix: revalidate payment amount + status ─────
  // The signature proves the payment_id is associated with the order_id,
  // but the AMOUNT isn't part of the signature, and the signature says
  // nothing about whether the payment was actually captured. Fetch the
  // payment from Razorpay to verify:
  //   1. gatewayPayment.amount === Payment.amount × 100 (amount matches)
  //   2. gatewayPayment.status === 'captured' (the payment is actually
  //      captured, not just authorized/created — only captured payments
  //      represent money that moved)
  // Defense-in-depth — Razorpay enforces the amount at checkout time,
  // but a backend bug or tampering attempt could otherwise let a
  // mismatched or non-captured payment slip through.
  try {
    const gatewayPayment = await client.payments.fetch(razorpayPaymentId);
    const expectedAmountPaise = toPaise(payment.amount);
    if (gatewayPayment.amount !== expectedAmountPaise) {
      await audit({
        actorId,
        action: 'RAZORPAY_AMOUNT_MISMATCH',
        targetType: 'Payment',
        targetId: payment.id,
        after: { expectedPaise: expectedAmountPaise, gatewayPaise: gatewayPayment.amount },
        req: null,
      });
      throw {
        statusCode: 400,
        code: 'PAYMENT_AMOUNT_MISMATCH',
        message: `Gateway payment amount ${gatewayPayment.amount}p does not match expected ${expectedAmountPaise}p`,
      };
    }
    // INO-AUDIT4-D25: verify the gateway payment is actually 'captured'.
    // A payment that's only 'authorized' or 'created' hasn't moved money
    // yet — marking it PAID would let the student's order proceed without
    // actual payment. Accept only 'captured' (and the Razorpay alias
    // 'processed' if it ever appears).
    const gatewayStatus = String(gatewayPayment.status || '').toLowerCase();
    if (gatewayStatus !== 'captured' && gatewayStatus !== 'processed') {
      await audit({
        actorId,
        action: 'RAZORPAY_NOT_CAPTURED',
        targetType: 'Payment',
        targetId: payment.id,
        after: { gatewayStatus, expectedStatus: 'captured' },
        req: null,
      });
      throw {
        statusCode: 400,
        code: 'PAYMENT_NOT_CAPTURED',
        message: `Gateway payment status is '${gatewayStatus}', expected 'captured'. The payment has not been captured yet.`,
      };
    }
  } catch (err) {
    if (err.statusCode && err.code) throw err; // re-throw our structured errors (AMOUNT_MISMATCH, NOT_CAPTURED)
    // INO-AUDIT7: fail-CLOSED, not fail-open. The previous implementation
    // logged the gateway-fetch error and continued to mark PAID — meaning
    // a valid signature + unreachable Razorpay API = PAID without amount
    // or capture-status confirmation. That's a fail-open security gap.
    //
    // Fix: if the gateway fetch fails (network / 5xx), DON'T mark PAID.
    // Return 503 so the frontend knows to retry. The payment stays PENDING.
    // The payment.captured webhook (if the gateway eventually sends it) or
    // the reconciliation worker (which polls for stale PENDING payments)
    // will confirm the payment independently.
    console.error('[payments] gateway fetch (amount+status) failed — NOT marking PAID:', err.message);
    throw {
      statusCode: 503,
      code: 'GATEWAY_VERIFICATION_UNAVAILABLE',
      message: 'Could not verify payment amount and capture status with Razorpay. The payment signature is valid, but the gateway is temporarily unreachable. Please retry — the payment will also be confirmed automatically via webhook or reconciliation if it was captured.',
    };
  }

  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: PAYMENT_STATUS.PENDING },
    data: {
      status: PAYMENT_STATUS.PAID,
      razorpayPaymentId,
      razorpaySignature,
    },
  });

  if (claimed.count !== 1) {
    const current = await prisma.payment.findUnique({ where: { id: payment.id }, include: { order: true } });
    if (current?.status === PAYMENT_STATUS.PAID) return { ...current, idempotent: true };
    throw { statusCode: 409, code: 'PAYMENT_STATE_RACE', message: 'Payment state changed while verifying' };
  }

  const updated = await prisma.payment.findUnique({
    where: { id: payment.id },
    include: { order: true },
  });

  await audit({
    actorId,
    action: 'PAYMENT_VERIFIED',
    targetType: 'Payment',
    targetId: payment.id,
    after: { status: PAYMENT_STATUS.PAID },
  });

  const { emitOrderEvent } = require('../../lib/socket');
  // INO-P0-2 fix: socket room name must include the `outlet:` prefix — the
  // socket server joins outlet staff to `outlet:<id>` rooms (lib/socket.js).
  // Emitting to bare `<outletId>` reaches no-one.
  emitOrderEvent('order:new', `outlet:${payment.order.outletId}`, { order: updated.order });

  return updated;
}

/**
 * Razorpay webhook handler — alternative path for payment confirmation
 * + refund state reconciliation.
 *
 * INO-AUDIT3-9 fix: previously only handled `payment.captured`. Now
 * handles 4 event types so the DB stays consistent with the gateway:
 *   - payment.captured    → mark Payment PAID (existing behavior)
 *   - payment.failed      → mark Payment FAILED (was: ignored, leaving
 *                            Payment stuck in PENDING forever)
 *   - refund.processed    → mark Refund COMPLETED + Payment REFUNDED
 *                           (was: ignored, so async refund completion
 *                           never propagated to the DB)
 *   - refund.failed       → mark Refund FAILED (was: ignored)
 *
 * All paths are idempotent — re-delivery of the same webhook is safe.
 *
 * Spec §2 principle 4: "No order is created until Razorpay webhook confirms
 * payment. No frontend 'payment success' is trusted." In practice, V1 trusts
 * the first of (verify endpoint, webhook) to confirm. The other path then
 * no-ops because the Payment row is already PAID.
 */
async function handleRazorpayWebhook(rawBody, signature, webhookSecret) {
  // Webhook secret comes from the URL path or the outlet record (we look up
  // by razorpay_order_id after parsing the body)
  // Here we just verify with the provided secret.
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (!safeEqual(expected, signature)) {
    throw { statusCode: 400, message: 'Invalid webhook signature' };
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event;

  // ─── Payment events ──────────────────────────────────────────────────
  if (eventType === 'payment.captured' || eventType === 'payment.failed') {
    return handlePaymentEvent(event, eventType);
  }

  // ─── Refund events ───────────────────────────────────────────────────
  if (eventType === 'refund.processed' || eventType === 'refund.failed') {
    return handleRefundEvent(event, eventType);
  }

  // Unknown event — log + ack so Razorpay stops retrying.
  console.log(`[razorpay webhook] ignoring event: ${eventType}`);
  return { ignored: true, event: eventType };
}

async function handlePaymentEvent(event, eventType) {
  const paymentEntity = event.payload?.payment?.entity;
  if (!paymentEntity) return { ignored: true };

  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
    include: { order: true },
  });
  if (!payment) return { ignored: true };

  if (eventType === 'payment.captured') {
    // Idempotent: if already PAID, just ack
    if (payment.status === PAYMENT_STATUS.PAID) return { alreadyPaid: true };

    // ─── INO-AUDIT4-D24 fix: verify the webhook payment amount ──────────
    // The webhook signature proves the payload is authentic from Razorpay,
    // but we additionally verify the captured amount matches what we expect
    // (Payment.amount × 100 paise). A mismatch indicates a serious state
    // inconsistency (or a Razorpay bug). Log + audit + reject; don't mark
    // PAID. (The /verify path already does this via client.payments.fetch;
    // the webhook path uses the payload's amount field directly since the
    // signature already proved authenticity.)
    const expectedAmountPaise = toPaise(payment.amount);
    if (paymentEntity.amount !== undefined
        && paymentEntity.amount !== null
        && paymentEntity.amount !== expectedAmountPaise) {
      console.error(
        `[razorpay webhook] payment.captured: amount mismatch — ` +
        `DB=${expectedAmountPaise}p gateway=${paymentEntity.amount}p (payment ${payment.id})`
      );
      await audit({
        actorId: null,
        action: 'PAYMENT_WEBHOOK_AMOUNT_MISMATCH',
        targetType: 'Payment',
        targetId: payment.id,
        after: { dbAmountPaise: expectedAmountPaise, gatewayAmountPaise: paymentEntity.amount },
        req: null,
      });
      return { ignored: true, reason: 'amount_mismatch' };
    }

    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: PAYMENT_STATUS.PENDING },
      data: {
        status: PAYMENT_STATUS.PAID,
        razorpayPaymentId,
      },
    });

    if (claimed.count !== 1) {
      const current = await prisma.payment.findUnique({ where: { id: payment.id } });
      return current?.status === PAYMENT_STATUS.PAID ? { alreadyPaid: true } : { ignored: true };
    }

    const updatedOrder = await prisma.order.findUnique({ where: { id: payment.order.id } });
    const { emitOrderEvent } = require('../../lib/socket');
    // INO-P0-2 fix: socket room name with `outlet:` prefix (see verify path).
    emitOrderEvent('order:new', `outlet:${payment.order.outletId}`, { order: updatedOrder });

    return { verified: true };
  }

  if (eventType === 'payment.failed') {
    // INO-AUDIT3-9 fix: previously this event was ignored, leaving Payment
    // stuck in PENDING forever even though Razorpay knew the payment failed.
    // Now we mark it FAILED so the student sees the failure + can retry.
    // Idempotent: if already FAILED, ack.
    if (payment.status === PAYMENT_STATUS.FAILED) return { alreadyFailed: true };
    // Don't downgrade from PAID/REFUNDED — those states represent money
    // that already moved; a late payment.failed event is suspicious
    // (likely a Razorpay retry of an already-resolved payment).
    if (payment.status !== PAYMENT_STATUS.PENDING) return { ignored: true };

    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: PAYMENT_STATUS.PENDING },
      data: { status: PAYMENT_STATUS.FAILED, razorpayPaymentId },
    });
    if (claimed.count !== 1) return { ignored: true };

    await audit({
      actorId: null,
      action: 'PAYMENT_FAILED',
      targetType: 'Payment',
      targetId: payment.id,
      after: { status: PAYMENT_STATUS.FAILED, razorpayPaymentId },
      req: null,
    });
    return { failed: true };
  }

  return { ignored: true };
}

async function handleRefundEvent(event, eventType) {
  // Refund webhook payload structure:
  //   event.payload.refund.entity = { id, payment_id, amount, status, ... }
  const refundEntity = event.payload?.refund?.entity;
  if (!refundEntity) return { ignored: true };

  const gatewayRefundId = refundEntity.id;
  const refundEntityPaymentId = refundEntity.payment_id;
  const refundEntityAmountPaise = refundEntity.amount; // Razorpay uses paise

  // Look up our Refund row by gatewayRef (set when we initiated the refund).
  // If we can't find it, this is a refund initiated outside our system
  // (e.g. directly in the Razorpay dashboard) — log + ack.
  let refund = await prisma.refund.findFirst({
    where: { gatewayRef: gatewayRefundId },
    include: { payment: true },
  });

  // ─── INO-AUDIT4-D26 fix: fallback reconciliation ───────────────────────
  // If the gatewayRef lookup failed, the most likely cause is: the gateway
  // accepted the refund but the HTTP response was lost (network timeout
  // between Razorpay → our server). Our Refund row has gatewayRef = NULL
  // because processRefundAfterCommit never got the gateway refund ID.
  //
  // Fallback: look up by (payment.razorpayPaymentId, amount, PENDING, gatewayRef=null).
  // This matches a PENDING refund whose amount (× 100 paise) equals the
  // gateway's amount field. There should be at most one such row per
  // payment (the in-flight refund). If we find it, update the gatewayRef
  // so future webhook deliveries match directly.
  if (!refund && refundEntityPaymentId && refundEntityAmountPaise !== undefined) {
    const candidates = await prisma.refund.findMany({
      where: {
        payment: { razorpayPaymentId: refundEntityPaymentId },
        status: REFUND_STATUS.PENDING,
        gatewayRef: null,
      },
      include: { payment: true },
    });
    // Filter by amount in JS (Prisma can't easily express "amount × 100 == X").
    const match = candidates.find(r =>
      toPaise(r.amount) === refundEntityAmountPaise
    );
    if (match) {
      // Update the gatewayRef now that we know it — future webhook
      // deliveries will match directly via the primary lookup above.
      refund = await prisma.refund.update({
        where: { id: match.id },
        data: { gatewayRef: gatewayRefundId },
        include: { payment: true },
      });
      console.log(
        `[razorpay webhook] refund ${refund.id} matched via fallback ` +
        `(payment_id + amount + PENDING); gatewayRef updated to ${gatewayRefundId}`
      );
      await audit({
        actorId: null,
        action: 'REFUND_GATEWAYREF_RECONCILED',
        targetType: 'Refund',
        targetId: refund.id,
        after: { gatewayRef: gatewayRefundId, reason: 'fallback_lookup_after_lost_response' },
        req: null,
      });
    }
  }

  if (!refund) {
    console.log(`[razorpay webhook] refund ${gatewayRefundId} not found in DB — external refund?`);
    return { ignored: true };
  }

  // ─── INO-AUDIT4-D7 fix: validate the webhook payload against our DB state ──
  // Defense-in-depth around financial reconciliation. The signature proves
  // the payload is authentic from Razorpay, but we additionally verify:
  //   1. refund.payment.razorpayPaymentId == refundEntity.payment_id
  //      (the gateway is refunding the same payment we think it is)
  //   2. Number(refund.amount) * 100 ≈ refundEntity.amount
  //      (the gateway is refunding the same amount we recorded — in paise)
  // A mismatch here would indicate a serious state inconsistency (or a
  // Razorpay bug). Log + reject; don't update the Refund row.
  if (refund.payment.razorpayPaymentId !== refundEntityPaymentId) {
    console.error(
      `[razorpay webhook] refund ${refund.id}: payment_id mismatch — ` +
      `DB=${refund.payment.razorpayPaymentId} gateway=${refundEntityPaymentId}`
    );
    await audit({
      actorId: null,
      action: 'REFUND_WEBHOOK_PAYMENT_ID_MISMATCH',
      targetType: 'Refund',
      targetId: refund.id,
      after: { dbPaymentId: refund.payment.razorpayPaymentId, gatewayPaymentId: refundEntityPaymentId },
      req: null,
    });
    return { ignored: true, reason: 'payment_id_mismatch' };
  }
  const expectedAmountPaise = toPaise(refund.amount);
  if (refundEntityAmountPaise !== undefined && refundEntityAmountPaise !== null
      && Math.abs(refundEntityAmountPaise - expectedAmountPaise) > 1) {
    // Allow 1 paise tolerance for rounding differences. Anything beyond
    // that is a real mismatch.
    console.error(
      `[razorpay webhook] refund ${refund.id}: amount mismatch — ` +
      `DB=${expectedAmountPaise}p gateway=${refundEntityAmountPaise}p`
    );
    await audit({
      actorId: null,
      action: 'REFUND_WEBHOOK_AMOUNT_MISMATCH',
      targetType: 'Refund',
      targetId: refund.id,
      after: { dbAmountPaise: expectedAmountPaise, gatewayAmountPaise: refundEntityAmountPaise },
      req: null,
    });
    return { ignored: true, reason: 'amount_mismatch' };
  }

  if (eventType === 'refund.processed') {
    // ─── INO-AUDIT4-D6 fix: refund state machine ────────────────────────
    // Only PENDING → COMPLETED is valid. Terminal states (COMPLETED, FAILED)
    // reject the contradictory event — a late/duplicate/reordered
    // refund.processed for an already-terminal Refund is suspicious and
    // should NOT silently flip the state. Log + ack instead.
    if (refund.status === REFUND_STATUS.COMPLETED) return { alreadyCompleted: true };
    if (refund.status === REFUND_STATUS.FAILED) {
      console.error(
        `[razorpay webhook] refund ${refund.id}: refund.processed received for FAILED refund — ignoring (terminal state)`
      );
      await audit({
        actorId: null,
        action: 'REFUND_WEBHOOK_TERMINAL_VIOLATION',
        targetType: 'Refund',
        targetId: refund.id,
        after: { from: refund.status, attemptedTo: REFUND_STATUS.COMPLETED },
        req: null,
      });
      return { ignored: true, reason: 'terminal_state_violation' };
    }

    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: { status: REFUND_STATUS.COMPLETED },
    });
    // ─── INO-AUDIT4-D2 fix: only mark Payment = REFUNDED if fully refunded ──
    // A partial refund (₹300 of ₹1000) leaves the Payment as PAID with
    // ₹700 still refundable. The helper checks sum(COMPLETED refunds)
    // against payment.amount.
    await markPaymentRefundedIfFullyRefunded(refund.payment.id);

    await audit({
      actorId: null,
      action: 'REFUND_COMPLETED',
      targetType: 'Refund',
      targetId: refund.id,
      after: { status: REFUND_STATUS.COMPLETED, gatewayRef: gatewayRefundId },
      req: null,
    });
    return { refundCompleted: true, refundId: updated.id };
  }

  if (eventType === 'refund.failed') {
    // ─── INO-AUDIT4-D6 fix: refund state machine ────────────────────────
    // Only PENDING → FAILED is valid. COMPLETED is terminal — a late
    // refund.failed for an already-COMPLETED refund is suspicious
    // (the gateway already told us it succeeded).
    if (refund.status === REFUND_STATUS.FAILED) return { alreadyFailed: true };
    if (refund.status === REFUND_STATUS.COMPLETED) {
      console.error(
        `[razorpay webhook] refund ${refund.id}: refund.failed received for COMPLETED refund — ignoring (terminal state)`
      );
      await audit({
        actorId: null,
        action: 'REFUND_WEBHOOK_TERMINAL_VIOLATION',
        targetType: 'Refund',
        targetId: refund.id,
        after: { from: refund.status, attemptedTo: REFUND_STATUS.FAILED },
        req: null,
      });
      return { ignored: true, reason: 'terminal_state_violation' };
    }

    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: { status: REFUND_STATUS.FAILED },
    });
    await audit({
      actorId: null,
      action: 'REFUND_FAILED',
      targetType: 'Refund',
      targetId: refund.id,
      after: { status: REFUND_STATUS.FAILED, gatewayRef: gatewayRefundId },
      req: null,
    });
    return { refundFailed: true, refundId: updated.id };
  }

  return { ignored: true };
}

// ─── INO-AUDIT5-D27 fix: processAutoRefundOnTransition is DELETED. ──────
// This function was the OLD refund engine — superseded by the
// transition.service.js + processRefundAfterCommit path in commit
// 1447845. It was kept for "backward compat" but nothing in the
// codebase called it anymore (the controller was refactored). Having
// two refund engines with different status-casing behavior (this one
// used `gatewayRefund.status || 'PENDING'` without `.toUpperCase()`,
// so it could store lowercase 'processed' instead of 'COMPLETED')
// was exactly the kind of state drift that causes bugs later.
//
// The new path is:
//   1. performTransition() creates the Refund row (status=PENDING) inside
//      the order-transition transaction.
//   2. processRefundAfterCommit(refundId, actorId) is the post-commit
//      gateway call + status update — it normalizes status to uppercase.
//
// If you need to retry a PENDING refund, use POST /api/v1/admin/refunds
// (adminService.issueManualRefund handles the retry path).

/**
 * Post-commit gateway refund processor — architectural refactor.
 *
 * `performTransition` in orders/transition.service.js creates a Refund row
 * with status=PENDING inside the order-transition transaction (the
 * "outbox pattern" lite). This function is the message processor: it
 * takes a freshly-created Refund row, calls the Razorpay gateway to
 * issue the refund, and updates the Refund + Payment rows based on the
 * gateway response.
 *
 * This is BEST-EFFORT: if the gateway call fails (network timeout, 5xx,
 * etc.), the Refund row stays PENDING. It's visible in the DB and can
 * be retried via POST /api/v1/admin/refunds (which calls this same
 * function via adminService.issueManualRefund's retry path).
 *
 * The function never throws — it catches gateway errors and leaves the
 * Refund as PENDING. (Network failures are a recovery problem, not a
 * request-failure problem — the order transition already committed.)
 */
async function processRefundAfterCommit(refundId, actorId) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      payment: { include: { order: { include: { outlet: true } } } },
    },
  });
  if (!refund) {
    console.error('[payments] processRefundAfterCommit: refund not found:', refundId);
    return null;
  }
  // Already processed — return as-is. (Idempotent: a retry path may
  // call this on a Refund that's already COMPLETED.)
  if (refund.status === REFUND_STATUS.COMPLETED) return refund;
  if (!refund.payment?.razorpayPaymentId) {
    console.error('[payments] processRefundAfterCommit: refund has no razorpayPaymentId:', refundId);
    return refund; // can't process — needs the gateway payment id
  }

  // INO-AUDIT5-OUTBOX: if the refund already has a REAL gatewayRef (not a
  // sentinel), the gateway call was already made. Don't create a duplicate.
  // The reconciliation worker (reconcilePendingRefunds) will poll the
  // existing refund's status.
  //
  // INO-AUDIT8-#4 fix: atomic claim via sentinel. The previous check
  // `if (refund.gatewayRef) return refund` had a TOCTOU race — two workers
  // could both read gatewayRef=NULL and both call client.payments.refund().
  // Fix: atomically claim via updateMany WHERE gatewayRef IS NULL. Only
  // the worker whose count === 1 calls the gateway. On failure, the sentinel
  // is reset to NULL so the next worker can retry. The stale-sentinel
  // cleanup in reconciliation.js handles crashes between the claim and
  // the gateway call.
  if (refund.gatewayRef && !refund.gatewayRef.startsWith('refund-in-progress-')) {
    // A REAL gateway refund ID is set — the gateway call already succeeded.
    return refund;
  }

  // Atomic claim: set a sentinel so concurrent workers can't both call the gateway.
  const refundSentinel = `refund-in-progress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const claimed = await prisma.refund.updateMany({
    where: { id: refundId, gatewayRef: null },
    data: { gatewayRef: refundSentinel },
  });
  if (claimed.count !== 1) {
    // Another worker already claimed it (sentinel set) OR a real gatewayRef
    // was set between our read and our claim. Either way, don't call the gateway.
    return prisma.refund.findUnique({ where: { id: refundId } });
  }

  let gatewayRef = refundSentinel; // start with the sentinel
  let newStatus = REFUND_STATUS.PENDING;
  try {
    const client = await getOutletRazorpayClient(refund.payment.order.outletId);
    const gatewayRefund = await client.payments.refund(refund.payment.razorpayPaymentId, {
      amount: toPaise(refund.amount),
      notes: {
        orderId: refund.payment.order.id,
        trigger: refund.triggeredBy,
        reason: refund.reason,
      },
    });
    gatewayRef = gatewayRefund.id;
    newStatus = (gatewayRefund.status || 'PENDING').toUpperCase();
  } catch (err) {
    console.error('[payments] post-commit gateway refund failed:', err.message);
    // INO-AUDIT8-#4: reset the sentinel back to NULL so the next worker
    // (outbox / admin retry) can retry the gateway call.
    await prisma.refund.update({
      where: { id: refundId },
      data: { gatewayRef: null, status: REFUND_STATUS.PENDING },
    }).catch(() => null);
    // Return the refund in its PENDING state — the outbox worker will retry.
    return prisma.refund.findUnique({ where: { id: refundId } });
  }

  const updated = await prisma.refund.update({
    where: { id: refundId },
    data: { gatewayRef, status: newStatus },
  });

  // ─── INO-AUDIT4-D2 fix: only mark Payment=REFUNDED if fully refunded ──
  // The helper checks sum(COMPLETED refunds) against payment.amount.
  // A partial refund leaves Payment = PAID with the remainder still
  // refundable.
  if (newStatus === REFUND_STATUS.COMPLETED || newStatus === 'PROCESSED') {
    await markPaymentRefundedIfFullyRefunded(refund.payment.id);
  }

  await audit({
    actorId,
    action: 'REFUND_PROCESSED',
    targetType: 'Refund',
    targetId: refund.id,
    after: { amount: refund.amount, status: newStatus, gatewayRef },
    req: null,
  });

  return updated;
}

module.exports = {
  getOutletRazorpayClient,
  setOutletRazorpayCredentials,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
  // INO-AUDIT5-D27: processAutoRefundOnTransition is DELETED (was dead
  // code — superseded by transition.service.js + processRefundAfterCommit).
  processRefundAfterCommit,
  // Exported for reuse by admin.service.js (manual refund paths need the
  // same partial-refund guard — INO-AUDIT4-D2).
  markPaymentRefundedIfFullyRefunded,
};
