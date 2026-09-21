# Nosh — Order State Machine

> Spec ref: `Campus_Food_Design_Spec.pdf` §8.6

## 1. State diagram

```
                  ┌──────────────────────────────────────────────────────┐
                  │                                                      │
                  ▼                                                      │
    PENDING ──► ACCEPTED ──► PREPARING ──► READY ──► COMPLETED            │
      │            │             │            │                          │
      │            │             │            └─► CANCELLED (no refund)   │
      │            │             │                student no-show        │
      │            └─────────────┴─────► CANCELLED (full refund)         │
      │                                                         outlet-initiated │
      └─► REJECTED (full refund)                                                 │
                                                                                  │
    Terminal states: COMPLETED, REJECTED, CANCELLED ◄────────────────────────────┘
```

## 2. State reference

| State      | Meaning                                              | Who can transition out         |
|------------|------------------------------------------------------|--------------------------------|
| `PENDING`  | Order placed, payment verified, awaiting outlet's accept | Outlet Staff/Admin → ACCEPTED or REJECTED; Super Admin → CANCELLED |
| `ACCEPTED` | Outlet has accepted the order; pre-prep              | Outlet Staff/Admin → PREPARING or CANCELLED |
| `PREPARING`| Outlet is cooking                                    | Outlet Staff/Admin → READY or CANCELLED |
| `READY`    | Ready for student pickup                              | Outlet Staff/Admin → COMPLETED or CANCELLED (no-show, NO refund) |
| `COMPLETED`| Student picked up. Terminal.                          | (none) |
| `REJECTED` | Outlet rejected pre-ACCEPTED. Terminal. Full refund. | (none) |
| `CANCELLED`| Outlet cancelled pre-READY (refund) or post-READY (no refund, no-show). Terminal. | (none) |

## 3. Allowed transitions (single source of truth)

Defined in `apps/backend/src/lib/constants.js`:

```js
const ALLOWED_TRANSITIONS = {
  PENDING:   ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED:  ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY:     ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED:  [],
  CANCELLED: [],
};
```

Any transition not listed here is a `400 INVALID_TRANSITION` error.

## 4. Refund rules

Per spec §8.6 + §14 decision 6:

| Transition                | Refund amount | Refund trigger           | Notes                          |
|---------------------------|---------------|---------------------------|--------------------------------|
| `PENDING → REJECTED`       | Full          | `OUTLET_REJECT`           | Outlet rejects before accepting |
| `PENDING → CANCELLED`     | Full          | `CUSTOMER_CANCEL` / `OUTLET_CANCEL` | Student cancels (pre-accept) or outlet cancels |
| `ACCEPTED → CANCELLED`    | Full          | `OUTLET_CANCEL`           | Outlet cancels during pre-prep |
| `PREPARING → CANCELLED`   | Full          | `OUTLET_CANCEL`           | Outlet cancels mid-prep |
| `READY → CANCELLED`       | NONE          | (no trigger; food wasted) | Student no-show / pickup timeout; no refund |
| `READY → COMPLETED`       | NONE          | (no trigger)              | Student picked up; no refund |

## 5. Student-initiated cancellation rules

Students are permitted to cancel an order **exclusively while the order is in the `PENDING` state** (before the outlet accepts it):

- **When PENDING:**
  - Student may cancel via `POST /api/v1/orders/:orderId/cancel`.
  - Automatically triggers a full refund (`triggeredBy=CUSTOMER_CANCEL`).
  - Order status transitions to `CANCELLED`, recording `"by": "studentId"` in the timeline.
- **Once ACCEPTED or subsequent states (`ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`, `REJECTED`):**
  - Student cancellation is strictly prohibited (`400 INVALID_TRANSITION: Orders can only be cancelled before the outlet accepts them`).
  - Once accepted, ingredients and food preparation are committed. The student must contact the outlet directly if special handling is required. Outlet staff can cancel from the outlet dashboard.
- Super admin can issue a manual refund via `POST /api/v1/admin/refunds` (`triggeredBy=SUPER_ADMIN_MANUAL`).

## 6. Timeline field

Each `Order` row has a `timeline` JSON column. Every status transition appends an entry:

```json
[
  { "status": "PENDING",   "at": "2026-09-21T10:00:00Z", "by": "user_abc" },
  { "status": "ACCEPTED",  "at": "2026-09-21T10:01:00Z", "by": "user_outlet_staff" },
  { "status": "PREPARING", "at": "2026-09-21T10:02:00Z", "by": "user_outlet_staff" },
  { "status": "READY",     "at": "2026-09-21T10:10:00Z", "by": "user_outlet_staff" },
  { "status": "COMPLETED", "at": "2026-09-21T10:20:00Z", "by": "user_outlet_staff" }
]
```

This is the audit trail for the order — separate from the global `AuditLog` table (which records actor + before/after for any state-changing op platform-wide).

## 7. Pickup no-show timeout

Per spec §4 entity #13 `pickupTimeoutMins` (default 30):

When an order enters `READY`, a background job should auto-transition it to `COMPLETED` after `pickupTimeoutMins` minutes IF the student doesn't pick up.

> ⚠️ In V1 the cron job is not yet implemented. The outlet staff/admin must manually mark `READY → COMPLETED` when the student collects the food. The cron is on the M3 roadmap.

## 8. Implementation pointers

| File | Responsibility |
|------|----------------|
| `src/lib/constants.js` | `ORDER_STATUS`, `ALLOWED_TRANSITIONS`, `REFUND_TRIGGERS` |
| `src/modules/orders/orders.service.js` | `updateOrderStatus()` enforces transition + payment guard |
| `src/modules/orders/orders.repository.js` | `updateStatus()` appends to timeline, sets state timestamps |
| `src/modules/payments/payments.service.js` | `processAutoRefundOnTransition()` issues Razorpay refund + records `Refund` row |
| `src/modules/orders/orders.controller.js` | `updateOrderStatus()` emits `order:status:changed` socket event, calls `notifications.service.createForOrder()` |
| `tests/auth.test.js`, `tests/validation.test.js`, `test-e2e.js`, `test-admin-e2e.js` | Cover happy path + invalid transitions + cross-outlet RBAC |
