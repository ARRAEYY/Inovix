# Nosh API — M2 Contracts (Payments + Cloudinary)

> Spec ref: §1.2 payment model, §4 entity #4 (Outlet) for encrypted credentials, §8.6 refund rules
> Status: Implemented (apps/backend/src/modules/payments/, apps/backend/src/lib/crypto.js)

## 1. Payment flow (per-outlet Razorpay)

```
┌───────────┐                    ┌───────────┐                ┌───────────┐
│  Student  │                    │  Backend  │                │ Razorpay  │
│  Frontend │                    │  (Express)│                │  Gateway  │
└─────┬─────┘                    └─────┬─────┘                └─────┬─────┘
      │                                │                            │
      │  POST /orders (create order)  │                            │
      │ ─────────────────────────────►│                            │
      │                                │ INSERT Order + Payment     │
      │                                │   (status=PENDING)        │
      │   201 Order                    │                            │
      │ ◄─────────────────────────────│                            │
      │                                │                            │
      │  POST /payments/razorpay/order │                            │
      │   { orderId }                  │                            │
      │ ─────────────────────────────►│                            │
      │                                │  Decrypt outlet creds     │
      │                                │  POST /v1/orders          │
      │                                │ ─────────────────────────►│
      │                                │   200 { id, amount, ... } │
      │                                │ ◄─────────────────────────│
      │                                │  UPDATE Payment            │
      │                                │   (gatewayRef, method)    │
      │  200 {                          │                            │
      │    razorpayOrderId,            │                            │
      │    amount, currency,           │                            │
      │    keyId (outlet's public key) │                            │
      │  }                              │                            │
      │ ◄─────────────────────────────│                            │
      │                                │                            │
      │  Show Razorpay Checkout        │                            │
      │ ─────────────────────────────────────────────────────────►│
      │                                │                            │
      │   payment success callback     │                            │
      │ ◄─────────────────────────────────────────────────────────│
      │                                │                            │
      │  POST /payments/razorpay/verify│                            │
      │   { razorpayOrderId,           │                            │
      │     razorpayPaymentId,         │                            │
      │     razorpaySignature }        │                            │
      │ ─────────────────────────────►│                            │
      │                                │  HMAC-SHA256 verify        │
      │                                │  UPDATE Payment            │
      │                                │   (status=PAID)            │
      │                                │  emit order:new to outlet  │
      │  200 { payment }               │                            │
      │ ◄─────────────────────────────│                            │
      │                                │                            │
      │                  (parallel)    │  POST /razorpay/webhook   │
      │                                │ ◄─────────────────────────│
      │                                │  Verify webhook signature  │
      │                                │  Idempotent: if PAID, ack  │
```

## 2. Endpoints

### `POST /api/v1/payments/razorpay/order`

Create a Razorpay Order at the gateway for an existing internal Order.

- **Auth**: Bearer access token, the order's student only
- **Body**: `{ orderId: string }`
- **Response 200**: `{ success: true, data: { razorpayOrderId, amount (paise), currency: "INR", keyId } }`
- **Errors**: 400 (outlet has no Razorpay credentials — `PAYMENT_NOT_CONFIGURED`), 403 (not your order), 404 (order not found), 409 (order already paid)
- **Side effects**: Updates `Payment.razorpayOrderId`, `Payment.gatewayRef`, `Payment.method`; AuditLog (`RAZORPAY_ORDER_CREATED`)

### `POST /api/v1/payments/razorpay/verify`

Verify the Razorpay signature returned by the checkout.

- **Auth**: Bearer access token
- **Body**: `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`
- **Response 200**: `{ success: true, data: Payment }` (status: PAID)
- **Errors**: 400 (invalid signature — `PAYMENT_FAILED`), 404 (payment row not found for gateway order)
- **Side effects**: Marks `Payment.status=PAID`; emits `order:new` to `outlet:<outletId>` room; AuditLog (`PAYMENT_VERIFIED` or `RAZORPAY_SIGNATURE_INVALID`)

### `POST /api/v1/payments/razorpay/webhook`

Razorpay webhook (called by Razorpay's servers). Idempotent.

- **Auth**: none — verified via HMAC signature in `X-Razorpay-Signature` header
- **Content-Type**: `application/json` — but parsed as `raw` because the signature is over the raw body
- **Headers**: `X-Razorpay-Signature: <hex sha256 hmac>`
- **Body**: Razorpay event payload (see Razorpay docs)
- **Response 200**: `{ success: true, data: { verified: true } | { alreadyPaid: true } | { ignored: true } }`
- **Side effects**: If event is `payment.captured` and Payment not yet PAID, marks it PAID + emits `order:new`. Other events are logged and ignored.

## 3. Super-admin: per-outlet Razorpay credentials

### `POST /api/v1/payments/admin/outlets/:outletId/razorpay-credentials`

Store encrypted Razorpay credentials for an outlet.

- **Auth**: SUPER_ADMIN
- **Body**: `{ keyId: string, keySecret: string, webhookSecret: string }`
- **Response 200**: `{ success: true, message: "Razorpay credentials stored (encrypted)" }`
- **Side effects**: AES-256-GCM encrypts each value with `OUTLET_CREDENTIALS_KEY`; stores in `Outlet.razorpayKeyIdEnc/KeySecretEnc/WebhookSecretEnc`; invalidates the in-memory Razorpay client cache for this outlet; AuditLog (`RAZORPAY_CREDENTIALS_SET`)

> The plain-text credentials NEVER touch the DB or logs at any point. After this call, only the encrypted ciphertext is stored.

## 4. Auto-refund flow

Triggered from `orders.controller.updateOrderStatus()` after a status transition:

```js
const { updated, before } = await ordersService.updateOrderStatus(...);
await paymentsService.processAutoRefundOnTransition(orderId, before.status, updated.status, req.user.id);
```

`processAutoRefundOnTransition`:

1. Looks up `REFUND_TRIGGERS[`${fromStatus}_TO_${toStatus}`]` (see `src/lib/constants.js`)
2. If trigger is null (e.g. `READY_TO_CANCELLED` — no refund), returns null
3. Fetches the order + its `Payment` + `Outlet`
4. If `Payment.status !== 'PAID'`, returns null (no refund possible)
5. Issues refund at Razorpay gateway via `client.payments.refund(razorpayPaymentId, { amount: <paise> })`
6. Records a `Refund` row with `triggeredBy`, `initiatedBy`, `amount`, `gatewayRef`, `status`
7. If gateway returns `processed`/`COMPLETED`, marks `Payment.status = REFUNDED`
8. Writes `AuditLog` (`REFUND_ISSUED`)

## 5. Manual refund (super-admin)

> Spec §3.1: super admin can "Issue manual refund (Razorpay dashboard + DB record)"

In V1, the super-admin records a refund issued via the Razorpay dashboard. Implementation TBD — endpoint will be:

```
POST /api/v1/admin/refunds
  { orderId, amount, reason, gatewayRef }
  → Creates Refund row with triggeredBy = SUPER_ADMIN_MANUAL
```

(Not yet implemented — M2 stretch.)

## 6. Cloudinary image uploads

> Spec §2 principle 5: "Images use Cloudinary with signed uploads from backend; frontend never holds Cloudinary credentials."

### `POST /api/v1/admin/upload/sign` (planned)

- **Auth**: SUPER_ADMIN or OUTLET_ADMIN (for own outlet's items)
- **Body**: `{ folder: "menu-items" | "outlet-logos", fileName }`
- **Response 200**: `{ success: true, data: { uploadUrl, signature, timestamp, publicId } }`
- **Frontend**: POSTs the image directly to `uploadUrl` with the signed params; never sees the API secret.

(Not yet implemented — M2 stretch. The `cloudinary` package is installed.)

## 7. Encryption details

See `docs/security.md` §4.1 for the AES-256-GCM format.
