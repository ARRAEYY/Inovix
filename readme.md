# Nosh

A prepaid campus food ordering platform where students order food from campus outlets and outlets manage orders in real time.

## Tech stack

- **Frontend**: React 19 + Vite 8 + react-router-dom 7 (TypeScript optional)
- **Backend**: Node.js + Express 5 + Prisma 5 + Socket.IO 4
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Validation**: Zod 4 (shared via `@nosh/validation` workspace package)
- **Auth**: JWT (15-min access + 7-day rotating refresh) + Google OAuth
- **Payments**: Razorpay (per-outlet accounts, credentials encrypted with AES-256-GCM)
- **Images**: Cloudinary (signed uploads from backend)
- **Realtime**: Socket.IO with long-polling fallback for restrictive networks

## Repository structure

```
nosh/
├── apps/
│   ├── frontend/      # React 19 + Vite
│   └── backend/       # Node.js + Express + Prisma + Socket.IO
│       └── prisma/
│           ├── schema.prisma     # 19 tables per spec §4
│           └── seed.js            # Idempotent seed (refactored from old mock data)
├── packages/
│   └── validation/   # @nosh/validation — shared Zod schemas
├── docs/
│   ├── architecture.md           # High-level architecture
│   ├── security.md               # Threat model + production checklist
│   ├── order-state-machine.md    # §8.6 state machine + refund rules
│   ├── api/
│   │   ├── m1-contracts.md       # Auth, catalog, cart, orders, menu, admin, audit
│   │   ├── m2-contracts.md       # Razorpay, Cloudinary
│   │   └── m3-contracts.md       # Socket.IO events, notifications
│   └── openapi.yaml               # OpenAPI 3.1 — import into Postman/Swagger
├── .env.example
└── package.json                   # workspace root
```

## Quick start (dev)

```bash
# 1. Clone + install
git clone https://github.com/ARRAEYY/Inovix.git
cd Inovix
npm install

# 2. Configure env
cp .env.example .env
# Edit .env — at minimum, set JWT_SECRET and OUTLET_CREDENTIALS_KEY to strong randoms:
#   openssl rand -hex 32  (for JWT_SECRET)
#   openssl rand -base64 32  (for OUTLET_CREDENTIALS_KEY)

# 3. Database — SQLite zero-setup, just:
npm run db:migrate     # creates apps/backend/dev.db + runs migrations
npm run db:seed        # seeds 12 users, 4 outlets, 9 menu items, 2 sample orders

# 4. Run backend
npm run dev:backend   # http://localhost:3000

# 5. (Optional) Run frontend in parallel terminal
npm run dev:frontend  # http://localhost:5173
```

## Dev test accounts

Only available when `NODE_ENV !== 'production'`. Login via `POST /api/v1/auth/dev-login`:

| Role          | Email                       | Password         |
|---------------|-----------------------------|------------------|
| SUPER_ADMIN   | `adilreyaz.admin@nosh.local`  | `NoshAdmin@123`    |
| OUTLET_ADMIN  | `adilreyaz.outlet@nosh.local` | `NoshOutlet@123`   |
| Student       | `adil@rishihood.edu.in`        | (Google-only — no dev login) |

Real students/staff log in via Google (`POST /api/v1/auth/google`) with `@rishihood.edu.in` emails.

## Common npm scripts

| Script                          | Description                                                  |
|---------------------------------|--------------------------------------------------------------|
| `npm run dev:backend`            | Start backend with `node --watch` (hot reload)               |
| `npm run dev:frontend`           | Start Vite dev server                                        |
| `npm run dev`                    | Both backend + frontend concurrently                         |
| `npm run test`                   | Run backend unit + integration tests                         |
| `npm run db:migrate`             | `prisma migrate dev` — apply schema changes                 |
| `npm run db:reset`               | Drop + recreate + skip-seed                                  |
| `npm run db:seed`                | Idempotent seed — safe to re-run                             |
| `npm run db:studio`              | Prisma Studio at localhost:5555                              |
| `npm run db:generate`            | Regenerate Prisma client (after schema changes)              |

## API documentation

- **OpenAPI 3.1**: `docs/openapi.yaml` — import into Postman or Swagger UI
- **Markdown contracts**: `docs/api/m1-contracts.md` through `m3-contracts.md`
- **Architecture**: `docs/architecture.md`
- **Security**: `docs/security.md`
- **Order state machine**: `docs/order-state-machine.md`

## Roles & RBAC (4 roles)

| Role          | Scope                  | Capabilities                                                                 |
|---------------|------------------------|------------------------------------------------------------------------------|
| `STUDENT`      | Platform-wide read     | Browse outlets, place orders, manage own cart, view own orders              |
| `OUTLET_STAFF` | Own outlet             | View + process outlet orders, toggle menu item availability                 |
| `OUTLET_ADMIN` | Own outlet             | Everything `OUTLET_STAFF` can do + CRUD on menu items + edit outlet profile |
| `SUPER_ADMIN`  | Platform-wide          | Approve/suspend users + outlets, view all orders/payments, audit log, manual refunds |

Enforced across 4 layers: JWT claims → Express middleware → Prisma row filters → Frontend UI hiding. See `docs/security.md`.

## Order state machine

```
PENDING → ACCEPTED → PREPARING → READY → COMPLETED
   │         │           │          │
   │         │           │          └─► CANCELLED (no refund — no-show)
   │         └───────────┴───► CANCELLED (full refund)
   └─► REJECTED (full refund)
```

Students may cancel orders exclusively while in `PENDING` state (triggers automatic refund). Once `ACCEPTED`, orders cannot be cancelled by students. See `docs/order-state-machine.md` for full refund rules.

## Production deployment

1. Set `NODE_ENV=production`
2. Switch Prisma provider: `provider = "postgresql"` in `apps/backend/prisma/schema.prisma`
3. Set `DATABASE_URL="postgresql://user:pass@host:5432/campus_food?schema=public"`
4. Run `npx prisma migrate deploy` (NOT `migrate dev` — production migrations are immutable)
5. Set `JWT_SECRET`, `OUTLET_CREDENTIALS_KEY` (different 32-byte values), `GOOGLE_CLIENT_ID`, `COLLEGE_EMAIL_DOMAIN`, `SOCKET_IO_CORS_ORIGIN`
6. Configure per-outlet Razorpay credentials via super-admin endpoint:
   ```
   POST /api/v1/payments/admin/outlets/:id/razorpay-credentials
   { keyId, keySecret, webhookSecret }
   ```
7. Configure Razorpay webhook URL in Razorpay dashboard → `https://api.yourcollege.edu.in/api/v1/payments/razorpay/webhook`
8. Set up cron jobs: audit log purge (90d), refresh token purge (30d), pickup timeout (auto-CANCELLED after `pickupTimeoutMins` — no refund, no-show)

See `docs/security.md` for the full production checklist.

## Status

### Implemented (M1 + M2 + M3 — full V1 backend, 8 rounds of security hardening)

- ✅ Prisma schema with all 19 spec tables (5 migrations: `collegeId @unique`, `verifiedAt → submittedAt`, refund partial unique index, `razorpayOrderId` unique)
- ✅ Real Zod schemas in shared `@nosh/validation` package (strict mode, bounded money, quantity limits, phone regex env-configurable)
- ✅ Auth: Google + dev-login (explicit opt-in via `ENABLE_DEV_LOGIN`) + refresh token rotation (transactional + constant-time hash comparison) + httpOnly cookie + logout + revoke on suspend
- ✅ Onboarding (first-time password + student profile; `submittedAt` instead of misleading `verifiedAt`)
- ✅ Catalog (outlets, menu, search, popular) — authenticated, OPEN/BUSY-only visibility enforced consistently
- ✅ Cart (server-side, one per student per outlet, 24h expiry, customization pricing in preview, P2002 race handling, CLOSED/SUSPENDED/PENDING outlets rejected)
- ✅ Orders (PENDING/ACCEPTED/PREPARING/READY/COMPLETED/REJECTED/CANCELLED state machine) — STUDENT-only authorization on student routes
- ✅ **Single transactional order-transition service** (`transition.service.js`) — order + audit + notification + refund-intent in one `prisma.$transaction`; cron + API both use it
- ✅ Outlet menu CRUD (OUTLET_ADMIN only) + **outlet-scoped uploads** (server-controlled publicId: `menu-items/<outletId>/<random>`)
- ✅ Admin (overview via DB-level groupBy, users, outlets, orders, menu, audit log) + **manual refund endpoint** (`POST /api/v1/admin/refunds` with partial-refund support + concurrent-refund race protection)
- ✅ Outlet dashboard KPIs endpoint (`GET /api/v1/outlet/orders/kpis` — single DB groupBy)
- ✅ Payments: Razorpay per-outlet, encrypted credentials, webhook (4 event types: `payment.captured`/`payment.failed`/`refund.processed`/`refund.failed`), **fail-closed verification** (503 on gateway-fetch failure), **amount + capture-status revalidation**, **atomic gateway-order claim** (sentinel pattern), **partial refund support** (multiple `SUPER_ADMIN_MANUAL` refunds), refund state machine (PENDING→COMPLETED/FAILED only)
- ✅ **Full financial reliability loop**: outbox worker (auto-processes orphaned PENDING refunds every 2 min) + reconciliation worker (polls gateway for missed webhooks every 10 min) + stale-sentinel cleanup (recovers stuck `in-progress-*` sentinels)
- ✅ **Distributed locking** for all cron jobs (Postgres advisory locks; SQLite dev = no-op)
- ✅ Notifications: DB-persisted + socket-emitted (PREPARING notification now triggered)
- ✅ Audit log (every state-changing operation, including reconciliation actions)
- ✅ Socket.IO server with room-based emits + long-polling fallback (Engine.IO v3 disabled)
- ✅ Cloudinary signed-upload endpoint (resource_type=image + allowed_formats enforced in signature)
- ✅ **Centralized money helpers** (`lib/money.js`) — integer paise arithmetic everywhere (orders, cart, payments, admin, reconciliation)
- ✅ Cron jobs: audit purge (90d), refresh purge (30d), **cart purge**, pickup timeout (auto-CANCELLED, calls `performTransition`), **refund outbox**, **stale-sentinel cleanup**, **refund reconciliation**, **payment reconciliation**
- ✅ Tests: pure-logic tests (signature verification, validation schemas, refund triggers, selectedOptions normalization, integer paise, refund amount validation) + concurrency tests (order transition race, token rotation race, refund race) + real student E2E (STUDENT token + explicit 403 boundary test) + admin E2E

### Frontend status

The frontend is **fully wired to the backend API** — every page calls the real REST endpoints via the shared axios `client.js` (`catalogService`, `menuService`, `orderService`, `notificationService`, `outletAdminService`, `authService`). The student Home / OutletMenu / Orders, admin Dashboard / Outlets / Users / Orders / Menu / Staff, and outlet Dashboard / OutletMenuPage / OutletAdminOrders / OutletAdminMenu / OutletAdminStaff pages all read live data, with loading + error states and optimistic updates for toggles.

The last hardcoded `MOCK_*` remnants have also been cleaned up:

- `OutletMobileHeader.jsx` — dropped the client-side `outlet-1 / outlet-2 / mock-outlet-adil` ID → name map; the header now reads `user.outlet.name` straight from the JWT payload, matching `OutletSidebar.jsx`.
- `admin/Profile.jsx` — `handleSave` is no longer a `setTimeout + alert` stub; it calls `PUT /auth/me` via `useAuth().updateProfile({ name })` with a success/error banner. Email is rendered disabled (the backend rejects email edits in V1).
- `admin/Settings.jsx` — there is no `/admin/settings` endpoint on the backend in V1, so the form is honest about that and persists to `localStorage` (`nosh:admin-settings:v1`) with a clear "backend persistence ships with the next milestone" notice, replacing the `Settings saved successfully (Mock)` stub.
- `student/OutletMenu.jsx` — the category sidebar no longer pulls placeholder images from `via.placeholder.com`; categories render self-contained CSS initial badges (`<CategoryIcon />`).
- `pages/auth/StudentLogin.jsx` — the post-login redirect is now role-aware (SUPER_ADMIN → `/admin`, OUTLET_ADMIN → `/outlet/admin`, OUTLET_STAFF → `/outlet`, STUDENT → `/student`). Previously it always navigated to `/student`, so a SUPER_ADMIN who used the student login form got bounced back to `/` by the role guard — looking like a failed login.

`AuthContext` stores only minimum UI identity in localStorage (id, name, email, role, outletId, onboardingCompleted).

### Google OAuth (M1 — wired, redirect flow)

The "Continue with Google" buttons on all three login pages (Student / Outlet / Admin) use the **OAuth authorization-code redirect flow** (more reliable than the GIS popup — works with popup blockers, headless browsers, mobile, and doesn't depend on FedCM):

1. User clicks "Continue with Google" → `window.location.href = '/api/v1/auth/google'`
2. Backend `GET /auth/google` (`googleAuthStart`): builds the Google consent URL with `redirect_uri=<origin>/api/v1/auth/google/callback` (origin derived from `X-Forwarded-Host` set by the Next.js reverse-proxy), sets a `google_oauth_state` httpOnly cookie (CSRF, 10-min TTL), 302-redirects to Google.
3. User picks an account on Google.
4. Google 302-redirects to `<origin>/api/v1/auth/google/callback?code=...&state=...`
5. Backend `GET /auth/google/callback` (`googleCallback`): verifies the state cookie (rejects with `state_mismatch` if missing/no-match), exchanges the code for tokens via `OAuth2Client.getToken()` (uses `GOOGLE_CLIENT_SECRET`), verifies the ID token, calls `findOrCreateGoogleUser`, issues access + refresh tokens, sets the `nosh_refresh` httpOnly cookie, 302-redirects to `/inovix-app/?google_login=success` (or `?google_login=error&reason=...` on failure).
6. The Inovix app loads — `AuthContext` detects `?google_login=success`, calls `/auth/refresh` (the Next.js proxy forwards the httpOnly `nosh_refresh` cookie), gets a fresh access token, calls `/auth/me`, stores the user, and the role-aware `PrivateRoute` / login-page navigation lands them on the right dashboard.

The GIS popup flow (`signInWithGooglePopup`) is kept in `useGoogleAuth.js` as a fallback for environments where the redirect_uri isn't registered.

#### Configuration

Backend `/tmp/Inovix/.env`:

```
GOOGLE_CLIENT_ID=199533025613-42r2moirh0h692unkn8912bj7vl1ig02.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>    # required for the code-exchange step (server-side)
COLLEGE_EMAIL_DOMAIN=.rishihood.edu.in                        # campus gate (production)
ALLOW_ANY_GOOGLE_EMAIL=true                                  # DEV ONLY — skip the campus-domain check so testers can log in with a regular Gmail
GOOGLE_OAUTH_FRONTEND_PATH=/inovix-app/                      # where the backend redirects after the callback (default)
```

Cloudinary (for outlet-scoped menu-item image uploads — `lib/cloudinary.js`):

```
CLOUDINARY_CLOUD_NAME=bvwu6qxm
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<still-needed — Cloudinary signed uploads require all three>
```

Frontend `apps/frontend/.env`:

```
VITE_GOOGLE_CLIENT_ID=199533025613-42r2moirh0h692unkn8912bj7vl1ig02.apps.googleusercontent.com   # public — safe for the browser
```

#### Google Cloud Console configuration

Under **APIs & Services → Credentials → [client ID]**:

- **Authorized JavaScript origins**: `http://localhost:3000` ✓ (registered)
- **Authorized redirect URIs**:
  - `http://localhost:3000/api/v1/auth/google/callback` ✓ (registered — matches the backend's `googleCallback` route)
  - `http://localhost:8000/api/auth/google/callback` (your older registration — unused by Inovix)

The backend auto-builds `redirect_uri` from the request's `X-Forwarded-Host` header (set by the Next.js reverse-proxy), so the same backend works for local dev (`http://localhost:3000`) and the preview (`https://preview-chat-*.space-z.ai`) — as long as each origin's callback URL is registered. For a new preview session, register `https://preview-chat-<session-id>.space-z.ai/api/v1/auth/google/callback`.

#### Dev-mode domain bypass

`ALLOW_ANY_GOOGLE_EMAIL=true` makes `verifyGoogleCredential()` skip the `COLLEGE_EMAIL_DOMAIN` check, so any verified Google email is accepted. **Never set this in production** — it would let any Gmail user log in as a student. Production keeps the default `@rishihood.edu.in` gate.

### TODO / next steps

- [x] Wire frontend to backend API (kill `MOCK_OUTLETS`/`MOCK_MENU`/`MOCK_ORDERS`) — done; all student/admin/outlet pages hit the real REST API. Last mock remnants (OutletMobileHeader name map, admin Profile/Settings stubs, via.placeholder category icons) cleaned up too.
- [ ] Add TanStack Query + invalidation on socket events
- [ ] Mocked integration tests for payment/refund flows (needs client factory refactor or `clientCache` export)
- [ ] DB-level CHECK constraints for enum fields (Postgres production only)
- [ ] `OrderStatusEvent` table (replace JSON timeline for better querying)
- [ ] Outlet CRUD endpoints (POST/DELETE) — currently managed via DB/seed
- [ ] Postgres-specific `@db.Decimal(10, 2)` annotations when migrating to prod
- [ ] CSV export endpoint (super-admin reports)

## License

ISC
