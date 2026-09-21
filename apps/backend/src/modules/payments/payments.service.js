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
const { PAYMENT_STATUS, REFUND_TRIGGER, REFUND_TRIGGERS } = require('../../lib/constants');
const { audit } = require('../../lib/audit');

// ─── Razorpay client cache (one per outlet, keyed by outletId) ──────────────
const clientCache = new Map();

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
 * order info instead of creating a new one. The previous implementation
 * unconditionally called `client.orders.create(...)`, so a double-click,
 * network retry, or duplicate frontend request would mint N gateway orders
 * for one internal order and overwrite `payment.razorpayOrderId` each time,
 * making earlier gateway orders impossible to associate with the internal
 * payment during reconciliation.
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

  const amountPaise = Math.round(Number(order.totalAmount) * 100);
  const keyId = decrypt(order.outlet.razorpayKeyIdEnc);

  // Idempotent: if we already have a gateway order id and the payment is
  // still PENDING (not yet verified), reuse it. The frontend can re-enter
  // checkout with the same gateway order id.
  if (
    order.payment?.razorpayOrderId &&
    order.payment?.status === PAYMENT_STATUS.PENDING
  ) {
    return {
      razorpayOrderId: order.payment.razorpayOrderId,
      amount: amountPaise,
      currency: 'INR',
      keyId,
    };
  }

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

  // Persist gateway ref on the Payment row
  const updated = await prisma.payment.update({
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
    targetId: updated.id,
    after: { gatewayRef: gatewayOrder.id, amount: order.totalAmount },
  });

  return {
    razorpayOrderId: gatewayOrder.id,
    amount: amountPaise,
    currency: 'INR',
    keyId,
  };
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
 * Razorpay webhook handler — alternative path for payment confirmation.
 * Razorpay calls this on payment.captured events. Idempotent.
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
  // V1 only handles payment.captured; other events are logged.
  if (event.event !== 'payment.captured') {
    console.log(`[razorpay webhook] ignoring event: ${event.event}`);
    return { ignored: true };
  }

  const paymentEntity = event.payload?.payment?.entity;
  if (!paymentEntity) return { ignored: true };

  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
    include: { order: true },
  });
  if (!payment) return { ignored: true };

  // Idempotent: if already PAID, just ack
  if (payment.status === PAYMENT_STATUS.PAID) return { alreadyPaid: true };

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

/**
 * Auto-refund on REJECTED or CANCELLED transitions (pre-READY).
 *
 * Called from orders.controller after a status change to REJECTED or
 * CANCELLED. Computes the refund trigger from the transition and:
 *   - If trigger is null (READY → CANCELLED, no-show): no refund.
 *   - Else: issues a full refund via Razorpay, records a Refund row.
 */
async function processAutoRefundOnTransition(orderId, fromStatus, toStatus, actorId, triggerOverride = null) {
  const triggerKey = `${fromStatus}_TO_${toStatus}`;
  const trigger = triggerOverride || REFUND_TRIGGERS[triggerKey];
  if (!trigger) return null; // no refund for this transition

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, outlet: true },
  });
  if (!order || !order.payment) return null;
  if (order.payment.status !== PAYMENT_STATUS.PAID) return null;

  // INO-P0-3 fix: idempotency at the payment layer. Before issuing a new
  // gateway refund, check whether a Refund row already exists for this
  // (paymentId, triggeredBy) pair. If it does, return it instead of
  // calling client.payments.refund again. This makes retry / cron /
  // double-trigger paths safe — a duplicate webhook delivery or a
  // controller retry won't double-charge the gateway.
  //
  // The cleanest invariant is a DB unique constraint on
  // (paymentId, triggeredBy) — that requires a migration and is on the
  // follow-up list. The service-level check here is the P0 minimum.
  const existing = await prisma.refund.findFirst({
    where: { paymentId: order.payment.id, triggeredBy: trigger },
  });
  if (existing) return existing;

  // Issue refund at gateway
  let gatewayRef = null;
  let refundStatus = 'PENDING';
  try {
    const client = await getOutletRazorpayClient(order.outletId);
    const gatewayRefund = await client.payments.refund(order.payment.razorpayPaymentId, {
      amount: Math.round(Number(order.totalAmount) * 100),
      notes: {
        orderId: order.id,
        trigger,
        reason: `Auto refund on ${fromStatus} → ${toStatus}`,
      },
    });
    gatewayRef = gatewayRefund.id;
    refundStatus = gatewayRefund.status || 'PENDING';
  } catch (err) {
    console.error('[payments] auto-refund failed at gateway:', err.message);
    // Mark refund as PENDING — super admin can retry via /api/v1/admin/refunds.
  }

  // Record the Refund row
  const refund = await prisma.refund.create({
    data: {
      paymentId: order.payment.id,
      amount: order.totalAmount,
      reason: `Auto refund: ${fromStatus} → ${toStatus}`,
      gatewayRef,
      status: refundStatus,
      triggeredBy: trigger,
      initiatedBy: actorId,
    },
  });

  // If refund is COMPLETED at gateway, mark Payment as REFUNDED
  if (refundStatus === 'COMPLETED' || refundStatus === 'processed') {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { status: PAYMENT_STATUS.REFUNDED },
    });
  }

  await audit({
    actorId,
    action: 'REFUND_ISSUED',
    targetType: 'Refund',
    targetId: refund.id,
    after: { amount: refund.amount, trigger, gatewayRef },
  });

  return refund;
}

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

  let gatewayRef = refund.gatewayRef;
  let newStatus = REFUND_STATUS.PENDING;
  try {
    const client = await getOutletRazorpayClient(refund.payment.order.outletId);
    const gatewayRefund = await client.payments.refund(refund.payment.razorpayPaymentId, {
      amount: Math.round(Number(refund.amount) * 100),
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
    // Leave as PENDING — admin can retry via /api/v1/admin/refunds.
  }

  const updated = await prisma.refund.update({
    where: { id: refundId },
    data: { gatewayRef, status: newStatus },
  });

  // If refund is COMPLETED at gateway, mark Payment as REFUNDED.
  if (newStatus === REFUND_STATUS.COMPLETED || newStatus === 'PROCESSED') {
    await prisma.payment.update({
      where: { id: refund.payment.id },
      data: { status: PAYMENT_STATUS.REFUNDED },
    });
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
  // Kept for backward compat — the new transition.service.js +
  // processRefundAfterCommit path replaces this for order transitions.
  // Old callers (if any) still work; new callers should use the
  // transition service + post-commit processor.
  processAutoRefundOnTransition,
  processRefundAfterCommit,
};
