const paymentsService = require('./payments.service');
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
 */
async function webhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing X-Razorpay-Signature header' });
    }

    // Resolve webhook secret by parsing the body to find the razorpay_order_id,
    // then looking up the outlet's stored webhook secret.
    const rawBody = req.body.toString('utf8');
    const event = JSON.parse(rawBody);
    const razorpayOrderId = event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id;
    if (!razorpayOrderId) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const payment = await require('../../lib/prisma').payment.findUnique({
      where: { razorpayOrderId },
      include: { order: { include: { outlet: true } } },
    });

    if (!payment) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const webhookSecretEnc = payment.order.outlet.razorpayWebhookSecretEnc;
    if (!webhookSecretEnc) {
      return res.status(200).json({ success: true, ignored: true });
    }
    const webhookSecret = require('../../lib/crypto').decrypt(webhookSecretEnc);

    const result = await paymentsService.handleRazorpayWebhook(rawBody, signature, webhookSecret);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = { createRazorpayOrder, verifyPayment, webhook };
