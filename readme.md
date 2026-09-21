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

No student-initiated cancellation in V1 (spec §14 decision 6). See `docs/order-state-machine.md` for full refund rules.

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
8. Set up cron jobs: audit log purge (90d), refresh token purge (30d), READY→COMPLETED timeout (30m per spec)

See `docs/security.md` for the full production checklist.

## Status

### Implemented (M1 + M2 + M3 — full V1 backend)

- ✅ Prisma schema with all 19 spec tables
- ✅ Real Zod schemas in shared `@nosh/validation` package
- ✅ Auth: Google + dev-login + refresh token rotation + logout + revoke on suspend
- ✅ Onboarding (first-time password + student profile)
- ✅ Catalog (outlets, menu, search, popular) — authenticated
- ✅ Cart (server-side, one per student per outlet, 24h expiry)
- ✅ Orders (PENDING/ACCEPTED/PREPARING/READY/COMPLETED/REJECTED/CANCELLED state machine)
- ✅ Outlet menu CRUD (OUTLET_ADMIN only)
- ✅ Admin (overview, users, outlets, orders, menu, audit log)
- ✅ Payments: Razorpay per-outlet, encrypted credentials, webhook, auto-refund on REJECTED/CANCELLED
- ✅ Notifications: DB-persisted + socket-emitted
- ✅ Audit log (every state-changing operation)
- ✅ Socket.IO server with room-based emits + long-polling fallback
- ✅ Cloudinary signed-upload endpoint (`POST /api/v1/uploads/sign`)
- ✅ Cron jobs: audit purge (90d), refresh purge (30d), pickup timeout (auto-COMPLETED after `pickupTimeoutMins`)
- ✅ Tests: 18 unit + admin E2E

### Frontend status

The frontend is at M1 visual-complete but still uses hardcoded `MOCK_*` data — needs wiring to the new backend API. See the audit review in the conversation history for the gap list.

### TODO / next steps

- [ ] Wire frontend to backend API (kill `MOCK_OUTLETS`/`MOCK_MENU`/`MOCK_ORDERS`)
- [ ] Add TanStack Query + invalidation on socket events
- [ ] Manual refund endpoint (super-admin via Razorpay dashboard)
- [ ] CSV export endpoint (super-admin reports)
- [ ] Distributed lock for cron in multi-instance deployments (Redis SET NX or Postgres advisory lock)
- [ ] Postgres-specific `@db.Decimal(10, 2)` annotations when migrating to prod

## License

ISC
