import client from './client';

const loadRazorpayScript = () => {
  if (typeof window !== 'undefined' && typeof window.Razorpay !== 'undefined') {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const existing = document.getElementById('razorpay-checkout-script');
    if (existing) {
      if (typeof window.Razorpay !== 'undefined') return resolve(true);
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Payment service — wires the prepaid order flow (every order is paid via
// Razorpay checkout BEFORE the order is considered placed).
//
// Flow:
//   1. orderService.createOrder() → { id, orderNumber, totalAmount, ... }
//   2. paymentService.createRazorpayOrder(orderId) → { razorpayOrderId, amount, currency, keyId }
//   3. paymentService.openCheckout({...}) → Razorpay checkout modal
//   4. On success → paymentService.verifyPayment({...}) → Payment.status = PAID
//   5. On failure/dismiss → order stays PENDING, student can retry from /orders

export const paymentService = {
  // POST /payments/razorpay/order — create a Razorpay order at the gateway
  // using the outlet's encrypted Razorpay credentials. Returns the gateway
  // order ID + the outlet's public keyId (for the checkout).
  createRazorpayOrder: async (orderId) => {
    const response = await client.post('/payments/razorpay/order', { orderId });
    return response.data;
  },

  // POST /payments/dev-confirm — dev-only mock payment confirm. The route
  // exists on the backend ONLY when NODE_ENV=development AND
  // ENABLE_DEV_LOGIN=true, so in production this call would 404 — and is
  // never made: the checkout only falls back to it when the gateway order
  // creation failed with PAYMENT_NOT_CONFIGURED AND import.meta.env.DEV.
  devConfirm: async (orderId) => {
    const response = await client.post('/payments/dev-confirm', { orderId });
    return response.data;
  },

  // POST /payments/razorpay/verify — verify the payment signature
  // (HMAC-SHA256 over razorpayOrderId + "|" + razorpayPaymentId, computed
  // with the outlet's keySecret). On success, Payment.status = PAID.
  verifyPayment: async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    const response = await client.post('/payments/razorpay/verify', {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return response.data;
  },

  // Open the Razorpay checkout modal. Returns a Promise that resolves on
  // successful payment (with the Razorpay response) or rejects on dismiss
  // / failure.
  openCheckout: async ({ keyId, razorpayOrderId, amount, currency, user, outletName }) => {
    const loaded = await loadRazorpayScript();
    if (!loaded || typeof window.Razorpay === 'undefined') {
      throw new Error('Razorpay checkout script failed to load. Please check your internet connection.');
    }

    return new Promise((resolve, reject) => {

      const options = {
        key: keyId,
        amount, // in paise
        currency: currency || 'INR',
        name: outletName || 'Nosh',
        description: 'Campus food order',
        order_id: razorpayOrderId,
        // Prefill the student's name + email from their Google profile
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        // The handler is called on successful payment
        handler: (response) => {
          resolve(response);
        },
        // Called when the user closes the checkout without paying
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled by user'));
          },
          escape: true,
          backdropclose: false,
        },
        // Test mode — show a note
        notes: {
          platform: 'Nosh',
          environment: 'test',
        },
        theme: {
          color: '#b10035',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        reject(new Error(response.error?.description || 'Payment failed'));
      });
      rzp.open();
    });
  },
};
