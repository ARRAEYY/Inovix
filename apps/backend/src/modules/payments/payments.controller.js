const paymentsService = require('./payments.service');
const prisma = require('../../lib/prisma');
const { decrypt } = require('../../lib/crypto');
const { audit } = require('../../lib/audit');
const { PAYMENT_STATUS } = require('../../lib/constants');

async function createRazorpayOrder(req, res, next) {
  try {
    const { orderId } = req.body;
    const result = await paymentsService.createRazorpayOrder(orderId, req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const result = await paymentsService.verifyRazorpayPayment(req.body, req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Razorpay webhook. This MUST be registered BEFORE body parsing middleware
 * (or use express.raw specifically for this route), because the webhook
 * signature is computed over the raw body. If JSON parsing happens first,
 * the signature won't match.
 *
 * The route is mounted with express.raw({ type: 'application/json' }) in
 * the routes file.
 *
 * INO-AUDIT4-D1 fix: the previous implementation only resolved the
 * outlet by `event.payload.payment.entity.order_id`. That works for
 * payment.* events but NOT for refund.* events — the refund entity is
 * keyed by `payment_id`, not `order_id`. So the controller returned
 * `ignored` for every refund event, and the new refund.processed /
 * refund.failed handlers in handleRazorpayWebhook were never reached.
 *
 * Fix: route by event type. For payment.* events, look up the Payment
 * by `event.payload.payment.entity.order_id` (Razorpay order ID). For
 * refund.* events, look up by `event.payload.refund.entity.payment_id`
 * (Razorpay payment ID — there's no unique constraint on this column,
 * but a Razorpay payment ID is unique at the gateway, so findFirst is
 * safe in practice).
 */
async function webhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing X-Razorpay-Signature header' });
    }

    const rawBody = req.body.toString('utf8');
    const event = JSON.parse(rawBody);
    const eventType = event.event;

    if (!eventType || typeof eventType !== 'string') {
      console.log('[razorpay webhook] missing/invalid event type');
      return res.status(200).json({ success: true, ignored: true });
    }

    // ─── Resolve the internal Payment + outlet by event type ────────────
    // The webhook secret is per-outlet, so we need to find the outlet
    // associated with this event before we can verify the signature.
    let payment;
    if (eventType.startsWith('payment.')) {
      // Payment events carry event.payload.payment.entity with order_id.
      const razorpayOrderId = event.payload?.payment?.entity?.order_id
        || event.payload?.order?.entity?.id;
      if (!razorpayOrderId) {
        console.log(`[razorpay webhook] ${eventType}: no order_id in payload — ignoring`);
        return res.status(200).json({ success: true, ignored: true });
      }
      payment = await prisma.payment.findUnique({
        where: { razorpayOrderId },
        include: { order: { include: { outlet: true } } },
      });
    } else if (eventType.startsWith('refund.')) {
      // Refund events carry event.payload.refund.entity with payment_id.
      const razorpayPaymentId = event.payload?.refund?.entity?.payment_id;
      if (!razorpayPaymentId) {
        console.log(`[razorpay webhook] ${eventType}: no payment_id in refund payload — ignoring`);
        return res.status(200).json({ success: true, ignored: true });
      }
      // No unique constraint on razorpayPaymentId (a payment ID is unique
      // at Razorpay, but the column is nullable for orders where payment
      // hasn't been captured yet). findFirst is safe — the first match is
      // the right one.
      payment = await prisma.payment.findFirst({
        where: { razorpayPaymentId },
        include: { order: { include: { outlet: true } } },
      });
    } else {
      // Unknown event type — log + ack so Razorpay stops retrying.
      console.log(`[razorpay webhook] unknown event type: ${eventType}`);
      return res.status(200).json({ success: true, ignored: true, event: eventType });
    }

    if (!payment) {
      console.log(`[razorpay webhook] ${eventType}: no matching Payment row — ignoring`);
      return res.status(200).json({ success: true, ignored: true });
    }

    const webhookSecretEnc = payment.order.outlet.razorpayWebhookSecretEnc;
    if (!webhookSecretEnc) {
      console.log(`[razorpay webhook] ${eventType}: outlet has no webhook secret configured — ignoring`);
      return res.status(200).json({ success: true, ignored: true });
    }
    const webhookSecret = decrypt(webhookSecretEnc);

    // The signature is verified inside the service. The service also
    // dispatches by event type to handlePaymentEvent / handleRefundEvent.
    const result = await paymentsService.handleRazorpayWebhook(rawBody, signature, webhookSecret);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = { createRazorpayOrder, verifyPayment, webhook };
