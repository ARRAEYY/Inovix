# Nosh — Security Model

> Spec ref: `Campus_Food_Design_Spec.pdf` §3 (RBAC), §4 (encryption at rest), §10 (security checklist)

## 1. Threat model summary

| Threat                              | Mitigation                                                       |
|-------------------------------------|------------------------------------------------------------------|
| Brute-force login                   | Per-endpoint rate limiters: Google 5/min, dev-login 10/min, refresh 30/15min, /me+/logout 60/min |
| Stolen JWT                          | 15-min access TTL + rotating refresh (transactional, constant-time hash compare) + revoke on logout/suspend |
| Replay attack on refresh token      | One-time-use refresh tokens; re-use triggers theft detection (revoke ALL for user) |
| Cross-outlet data access            | Layer 3 Prisma row filters: `where: { outletId }` enforced in repository + STUDENT-only auth on student routes |
| Parameter pollution                 | Zod `.strict()` schemas reject unknown keys                       |
| Razorpay webhook forgery            | HMAC-SHA256 over raw body, verified in constant time; webhook routes by event type (payment.* vs refund.*) |
| Payment amount tampering            | Gateway fetch + amount revalidation (fail-closed: 503 if gateway unreachable, 400 if amount mismatch) |
| Non-captured payment marked PAID    | Gateway status check: only `captured`/`processed` accepted (400 PAYMENT_NOT_CAPTURED otherwise) |
| Concurrent gateway-order creation  | Atomic sentinel claim via `updateMany WHERE razorpayOrderId IS NULL` |
| Concurrent refund over-payment      | `SELECT FOR UPDATE` on Payment row + remaining-refundable check inside `prisma.$transaction` |
| Duplicate refund at gateway        | Atomic sentinel claim on Refund.gatewayRef + stale-sentinel cleanup |
| Partial refund state inconsistency  | `markPaymentRefundedIfFullyRefunded` — Payment only REFUNDED when `sum(COMPLETED refunds) >= payment.amount` (integer paise) |
| Refund webhook mismatch            | Fallback reconciliation: match by (payment_id, amount, PENDING, gatewayRef=NULL) when primary gatewayRef lookup fails |
| Missed webhook (server down)       | Reconciliation worker polls gateway every 10 min for PENDING refunds + stale PENDING payments |
| Stuck sentinel (process crash)     | Stale-sentinel cleanup every 10 min: recovers gateway order by receipt OR resets to NULL |
| Stored-credential leak (DB breach)  | AES-256-GCM encryption for outlet Razorpay keys (separate key from JWT_SECRET) |
| XSS in frontend storing JWT          | Refresh token in httpOnly cookie (not localStorage); localStorage stores only minimum UI identity (id, name, email, role) |
| Mass-assignment (role escalation)   | Role is never read from `req.body`; always from `req.user.role` after DB lookup |
| SQL injection                       | Prisma client — every query is parameterized                     |
| College email spoofing              | Google OAuth + `email_verified` flag + `COLLEGE_EMAIL_DOMAIN` domain-equality check (leading dot = subdomains allowed) |
| Dev-login in non-dev envs           | Explicit opt-in: `NODE_ENV=development AND ENABLE_DEV_LOGIN=true` (route not mounted otherwise) |
| Cloudinary upload abuse             | Signed uploads enforce `resource_type=image` + `allowed_formats` in signature; server-controlled publicId for student + outlet-scoped folders |
| Money arithmetic drift              | Centralized `lib/money.js` — integer paise everywhere; `Number.isFinite` + upper bound on all monetary fields |
| Cron double-fire (multi-instance)   | Postgres advisory locks (`pg_try_advisory_xact_lock`) on every cron job |

## 2. Authentication

### 2.1 Token types

| Token       | TTL  | Storage           | Signed/verified with  |
|-------------|------|-------------------|------------------------|
| Access      | 15 min | Frontend memory or httpOnly cookie | `JWT_SECRET` |
| Refresh     | 7 days | DB (sha256-hashed) + httpOnly cookie | `JWT_SECRET` (only for the wrapping envelope; the inner secret is opaque) |

### 2.2 Refresh token rotation

```
Login → access(15m) + refresh1(7d)

[Time passes, access expires]

POST /api/v1/auth/refresh { refreshToken: refresh1 }
  → Server looks up refresh1 by id
  → Checks: not expired, not revoked, hash matches
  → Issues refresh2 (new row, new hash)
  → Marks refresh1 as revoked, replacedBy=refresh2.id
  → Returns access(new) + refresh2

[If refresh1 is presented again later]
  → Server sees refresh1.revokedAt is set
  → TOKEN THEFT DETECTED — revokes ALL refresh tokens for this user
  → Returns 401; user must re-login
```

### 2.3 Account suspension

When super admin sets a user's status to `SUSPENDED`:

1. User record is updated
2. `revokeAllForUser(userId)` revokes every active refresh token
3. Any in-flight access token (≤15 min remaining) will fail on the next `protect` middleware call because the middleware looks up the live user record (not the JWT-embedded role)

## 3. Authorization (RBAC)

### 3.1 Roles (4 total per spec §3)

| Role          | Scope                  | Can do                                                                              |
|---------------|------------------------|-------------------------------------------------------------------------------------|
| `STUDENT`      | Platform-wide read     | Browse outlets, place orders, view own orders, manage own cart                     |
| `OUTLET_STAFF` | Own outlet             | View + process outlet orders, toggle menu item availability                         |
| `OUTLET_ADMIN` | Own outlet             | Everything OUTLET_STAFF can do + create/edit/delete menu items, edit outlet profile |
| `SUPER_ADMIN`  | Platform-wide          | Approve/suspend users + outlets, view all orders/payments, issue manual refunds, view audit log |

### 3.2 Enforcement layers (4 layers per spec §3.2)

1. **JWT claims** — every authenticated request carries `Authorization: Bearer <access>`
2. **Express middleware** (3 composable guards):
   - `protect` — verifies JWT, looks up live user, attaches `req.user`
   - `authorizeRole(...roles)` — checks role ∈ allowed list
   - `requireOutletScope` — ensures `req.user.outletId` is set (or user is super admin)
3. **Prisma row-level filters** — every outlet-scoped Prisma query includes `where: { outletId }`. **Code-review checklist item**: no `prisma.outlet.findMany({})` without an `outletId` filter when called from a non-super-admin context.
4. **Frontend UI hiding** — sidebar items, action buttons, route guards keyed off `user.role` from `AuthContext`. **Convenience, not security.**

### 3.3 Forbidden patterns (code review checklist)

```js
// ❌ NEVER: trust role from request body
const { role } = req.body;
if (role === 'SUPER_ADMIN') { ... }

// ❌ NEVER: read outletId from request body when the user is outlet-scoped
const outletId = req.body.outletId;
prisma.outlet.findUnique({ where: { id: outletId } });

// ❌ NEVER: list all outlets/orders without an outletId filter from non-super-admin context
prisma.order.findMany({}); // FORBIDDEN — must include where: { outletId: req.user.outletId }

// ✅ CORRECT: role + outletId come from the JWT-verified user record
const { role, outletId } = req.user;
prisma.order.findMany({ where: { outletId } }); // outlet-scoped

// ✅ CORRECT: super-admin-only endpoints use authorizeRole(SUPER_ADMIN)
router.use(protect, authorizeRole(ROLES.SUPER_ADMIN));
```

## 4. Encryption at rest

### 4.1 Razorpay credentials (per outlet)

Per spec §4 entity #4: AES-256-GCM with `OUTLET_CREDENTIALS_KEY` (separate from `JWT_SECRET`).

| Field on `Outlet`            | Stored as                                                |
|-------------------------------|----------------------------------------------------------|
| `razorpayKeyIdEnc`             | `base64(iv):base64(authTag):base64(ciphertext)`          |
| `razorpayKeySecretEnc`         | Same format                                              |
| `razorpayWebhookSecretEnc`     | Same format                                              |

Why GCM over CBC: GCM is **authenticated** — the auth tag detects tampering. CBC is malleable.

The `iv` is 96 bits, unique per encryption (random), never reused with the same key.

### 4.2 Refresh tokens

Stored as sha256 hash (not the raw token). Even a DB read can't mint a refresh token.

### 4.3 Passwords

Stored as bcrypt hash with 12 salt rounds (`src/utils/password.js`). bcrypt is slow on purpose — slows down offline cracking if the DB is breached.

## 5. Payment security

### 5.1 Razorpay signature verification

The `verifyRazorpayPayment` flow:

```
signature = HMAC-SHA256(razorpayOrderId + "|" + razorpayPaymentId, keySecret)

expected = crypto.createHmac('sha256', keySecret)
                .update(`${razorpayOrderId}|${razorpayPaymentId}`)
                .digest('hex')

if (!safeEqual(expected, providedSignature)) {
  // Invalid — DO NOT mark Payment as PAID
  return 400;
}
```

`safeEqual` uses `crypto.timingSafeEqual` to prevent timing side-channels.

### 5.2 Webhook signature

```
expected = HMAC-SHA256(rawRequestBody, webhookSecret)

if (!safeEqual(expected, X-Razorpay-Signature header)) {
  return 400;
}
```

**Critical**: the webhook route uses `express.raw({ type: 'application/json' })` because the signature is computed over the **raw body bytes**, not the parsed JSON. If JSON parsing happens first, the body is re-serialized differently (whitespace, key order) and the signature won't match.

### 5.3 Idempotency

The webhook is idempotent — if the verify endpoint already marked the Payment as `PAID`, the webhook acks and returns without re-doing work. Either path can confirm payment; the spec principle "the DB is the source of truth" applies.

## 6. Rate limiting

| Endpoint group          | Limit                | Window      | Skip in tests |
|-------------------------|----------------------|-------------|---------------|
| `/api/v1/auth/*`         | 20 requests per IP   | 15 minutes  | Yes           |
| `/api/v1/*` (general)    | 200 requests per IP  | 1 minute    | Yes           |

Spec §5 calls for 5 req/min on `/auth/login` and 10 req/min on password reset. The current 20/15min is more permissive (suitable for dev); tighten before launch.

## 7. CORS

```js
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,  // required for cookies (refresh token)
}));
```

In production, set `FRONTEND_URL` to the actual deployed frontend URL.

## 8. Helmet headers

`helmet()` sets:
- `Content-Security-Policy`: restrictive default (blocks inline scripts unless explicitly allowed)
- `Strict-Transport-Security`: 1 year, includeSubDomains
- `X-Frame-Options`: DENY (no clickjacking)
- `X-Content-Type-Options`: nosniff
- `Referrer-Policy`: strict-origin-when-cross-origin

## 9. Audit log

Every state-changing outlet/admin operation writes an `AuditLog` row. See `docs/architecture.md` §8.

## 10. Production security checklist (run before launch)

- [ ] `JWT_SECRET` is a 32+ char random string from `openssl rand -hex 32`
- [ ] `OUTLET_CREDENTIALS_KEY` is a 32-byte base64 string from `openssl rand -base64 32`, **different** from `JWT_SECRET`
- [ ] `NODE_ENV=production` is set (disables dev-login, hides 500 details)
- [ ] Rate limits tuned to spec (5/min on auth login, 10/min on password reset)
- [ ] CORS origin whitelist contains only the production frontend URL
- [ ] HTTPS termination at the load balancer or via Caddy/NGINX
- [ ] `helmet` is enabled (it is by default)
- [ ] Database backups configured (`pg_dump` cron, 30-day rolling)
- [ ] AuditLog retention cron (90 days)
- [ ] RefreshToken purge cron (delete tokens expired > 30 days)
- [ ] Razorpay webhook URL configured in Razorpay dashboard
- [ ] Per-outlet Razorpay credentials stored via super-admin endpoint (never in code/env)
- [ ] Cloudinary credentials NOT exposed to the frontend (backend signs upload URLs)
- [ ] Google OAuth client ID restricted to the production domain in Google Cloud Console
- [ ] College email domain suffix is correct (`COLLEGE_EMAIL_DOMAIN`)
