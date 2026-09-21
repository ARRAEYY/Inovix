# Nosh API — M1 Contracts

> Spec ref: §5 API Contract Structure
> Status: Implemented (apps/backend/src/modules/*)

This document specifies every endpoint delivered in M1. Each entry includes: HTTP method + path, auth requirement, request body schema, response 200, error responses, side effects, and required tests.

## 1. Envelope (consistent across all endpoints)

```jsonc
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "pageSize": 20, "total": 137 } }

// Error
{ "success": false, "message": "...", "code": "VALIDATION_ERROR", "errors": [] }
```

## 2. Health

### `GET /health`

- **Auth**: none
- **Response 200**: `{ success: true, message: "...", environment: "development"|"production", timestamp: ISO }`

## 3. Auth

### `POST /api/v1/auth/google`

Student + staff Google Sign-In.

- **Auth**: none
- **Body**: `{ credential: string }` (Google ID token)
- **Response 200**: `{ success: true, data: { user, accessToken: string, refreshToken: string } }`
- **Errors**: 400 (bad credential), 401 (Google verification failed), 403 (email not in college domain, or email not verified, or account suspended)
- **Side effects**: Creates `User` row if first login; writes `AuditLog` (`USER_GOOGLE_LOGIN` or `USER_GOOGLE_REGISTER`); issues `RefreshToken` row.
- **Tests**: `tests/auth.test.js`

### `POST /api/v1/auth/dev-login` (dev-only, disabled when `NODE_ENV=production`)

- **Body**: `{ email: string, password?: string }`
- **Response 200**: `{ success: true, data: { user, accessToken, refreshToken } }`
- **Errors**: 401 (invalid password), 403 (suspended), 404 (user not found)
- **Side effects**: Updates `lastLoginAt`; issues `RefreshToken`; writes `AuditLog` (`USER_DEV_LOGIN`)

### `GET /api/v1/auth/me`

- **Auth**: Bearer access token
- **Response 200**: `{ success: true, data: { user } }` (passwordHash stripped)
- **Errors**: 401 (missing/invalid token, user not found, account suspended)

### `POST /api/v1/auth/refresh`

- **Auth**: none
- **Body**: `{ refreshToken: string }`
- **Response 200**: `{ success: true, data: { user, accessToken, refreshToken } }` (new pair)
- **Errors**: 401 (invalid/expired/revoked refresh)
- **Side effects**: Marks the presented refresh as revoked, sets `replacedBy` to the new refresh id; issues a new `RefreshToken`; on theft detection (re-use of already-rotated refresh), revokes ALL the user's refresh tokens.

### `POST /api/v1/auth/logout`

- **Auth**: Bearer access token
- **Body**: `{ refreshToken?: string }` (optional)
- **Response 200**: `{ success: true, message: "Logged out successfully" }`
- **Side effects**: Revokes the presented refresh token (if any); writes `AuditLog` (`USER_LOGOUT`)

## 4. Onboarding

### `POST /api/v1/onboarding`

First-time password setup + student profile (after Google login if `user.onboardingCompleted === false`).

- **Auth**: Bearer access token
- **Body**: `{ password: string (8+, with upper/lower/digit), profile: { fullName, phone (10-digit), course, year, collegeId } }`
- **Response 200**: `{ success: true, data: { user } }` (updated, passwordHash stripped)
- **Errors**: 400 (role ≠ STUDENT, weak password, missing profile fields), 404 (user not found), 409 (already onboarded)
- **Side effects**: Hashes password with bcrypt (12 rounds); creates `StudentProfile` row; writes `AuditLog` (`USER_ONBOARDED`)

## 5. Catalog (student-facing browse)

> All catalog routes are now authenticated (spec §3 Layer 1: "every authenticated request carries a JWT"). Previously these were public; that was a spec deviation, now fixed.

### `GET /api/v1/catalog/outlets`

List all OPEN/BUSY outlets.

- **Auth**: Bearer access token (any role)
- **Query**: none
- **Response 200**: `{ success: true, data: Outlet[] }`

### `GET /api/v1/catalog/outlets/:id`

- **Auth**: Bearer access token
- **Response 200**: `{ success: true, data: Outlet }`
- **Errors**: 404

### `GET /api/v1/catalog/outlets/:id/menu`

- **Auth**: Bearer access token
- **Response 200**: `{ success: true, data: MenuItem[] }`

### `GET /api/v1/catalog/outlets/:id/categories`

- **Auth**: Bearer access token
- **Response 200**: `{ success: true, data: MenuCategory[] }`

### `GET /api/v1/catalog/menu/popular`

- **Auth**: Bearer access token
- **Response 200**: `{ success: true, data: MenuItem[] }` (filter: `popular: true, isAvailable: true`)

### `GET /api/v1/catalog/search?q=...`

- **Auth**: Bearer access token
- **Response 200**: `{ success: true, data: { outlets: Outlet[], menuItems: MenuItem[] } }`

## 6. Cart (server-side, per spec §6.2)

### `GET /api/v1/cart`

Returns the user's active cart (or null).

- **Auth**: Bearer access token, role=STUDENT
- **Response 200**: `{ success: true, data: Cart|null }` (includes `items` with `menuItem`)

### `GET /api/v1/cart/totals`

- **Auth**: STUDENT
- **Response 200**: `{ success: true, data: { subtotal, platformFee, total, itemCount } }`

### `DELETE /api/v1/cart`

Clears the active cart.

- **Auth**: STUDENT
- **Response 200**: `{ success: true, message: "Cart cleared" }`

### `GET /api/v1/cart/outlets/:outletId`

Returns (or creates) the cart for the given outlet. If a cart exists for a different outlet, the old one is expired.

- **Auth**: STUDENT
- **Response 200**: `{ success: true, data: Cart }`

### `POST /api/v1/cart/outlets/:outletId/items`

- **Body**: `{ menuItemId, quantity, selectedOptions?: [{ groupId, optionId }] }`
- **Response 200**: `{ success: true, data: Cart }` (updated)
- **Errors**: 400 (menu item unavailable, menu item doesn't belong to outlet), 404 (menu item not found)
- **Side effects**: Refreshes cart `expiresAt` to +24h

### `PATCH /api/v1/cart/items/:cartItemId`

- **Body**: `{ quantity }`
- **Response 200**: `{ success: true, data: Cart }`
- **Errors**: 403 (not your cart), 404 (cart item not found)

### `DELETE /api/v1/cart/items/:cartItemId`

- **Response 200**: `{ success: true, data: Cart|null }`

## 7. Orders

### `POST /api/v1/orders`

Student creates an order.

- **Auth**: STUDENT
- **Body**: `{ outletId, items: [{ menuItemId, quantity, selectedOptions? }], paymentMethod: "ONLINE"|"WALLET", notes?, scheduledFor? }`
- **Response 201**: `{ success: true, data: Order }` (status: PENDING, payment.status: PENDING)
- **Errors**: 400 (outlet closed, item unavailable, item not in outlet, invalid quantity), 404 (outlet or menu item not found)
- **Side effects**: Creates `Order` + `OrderItem[]` + `Payment` (status=PENDING) in a transaction; emits `order:new` to the outlet room; writes `AuditLog` (`ORDER_CREATED`)
- **Validation**: `createOrderSchema` (Zod, strict)

### `GET /api/v1/orders?page=1&pageSize=20&status=PENDING`

List student's own orders.

- **Auth**: any authenticated user
- **Response 200**: `{ success: true, data: Order[] }`

### `GET /api/v1/orders/:orderId`

- **Auth**: Order's student only
- **Response 200**: `{ success: true, data: Order }`
- **Errors**: 403 (not your order), 404

### `GET /api/v1/outlet/orders?page=1&pageSize=50&status=ACCEPTED`

Outlet dashboard — list own outlet's orders.

- **Auth**: OUTLET_STAFF or OUTLET_ADMIN (with `requireOutletScope`)
- **Response 200**: `{ success: true, data: Order[] }`

### `GET /api/v1/outlet/orders/:orderId`

- **Auth**: OUTLET_STAFF/ADMIN
- **Errors**: 403 (cross-outlet access blocked), 404

### `PATCH /api/v1/outlet/orders/:orderId/status`

- **Body**: `{ status: "ACCEPTED"|"PREPARING"|"READY"|"COMPLETED"|"REJECTED"|"CANCELLED", reason? }`
- **Response 200**: `{ success: true, data: Order }` (updated)
- **Errors**: 400 (invalid transition — `INVALID_TRANSITION`, payment not yet PAID — `PAYMENT_REQUIRED`), 403 (cross-outlet)
- **Side effects**: Appends to `timeline` JSON; sets state timestamps (`acceptedAt`/`readyAt`/etc.); writes `AuditLog` (`ORDER_STATUS_CHANGED`); emits `order:status:changed` to both `outlet:<id>` and `student:<userId>` rooms; calls `notifications.service.createForOrder()` (creates `Notification` + emits `notification:created`); triggers auto-refund via `payments.service.processAutoRefundOnTransition()` for REJECTED or pre-READY CANCELLED transitions.

## 8. Menu (outlet-scoped CRUD)

### `GET /api/v1/outlet/menu`

- **Auth**: OUTLET_STAFF or OUTLET_ADMIN
- **Response 200**: `{ success: true, data: MenuItem[] }` (scoped to `req.user.outletId`)

### `GET /api/v1/outlet/menu/:itemId`

- **Errors**: 403 (item belongs to different outlet)

### `POST /api/v1/outlet/menu`

- **Auth**: OUTLET_ADMIN only
- **Body**: `menuItemCreateSchema` — name, price, category, description?, image?, isAvailable?, discount?, popular?, vegetarian?, preparationTime?, dietaryFlags?
- **Response 201**: `{ success: true, data: MenuItem }`
- **Side effects**: AuditLog (`MENU_ITEM_CREATED`)

### `PATCH /api/v1/outlet/menu/:itemId`

- **Auth**: OUTLET_ADMIN
- **Body**: `menuItemUpdateSchema` (partial)
- **Side effects**: AuditLog (`MENU_ITEM_UPDATED`)

### `DELETE /api/v1/outlet/menu/:itemId`

- **Auth**: OUTLET_ADMIN
- **Side effects**: AuditLog (`MENU_ITEM_DELETED`)

## 9. Notifications

### `GET /api/v1/notifications?page=1&pageSize=20&unread=true`

- **Auth**: any authenticated user
- **Response 200**: `{ success: true, data: { items: Notification[], total, unreadCount, page, pageSize } }`

### `POST /api/v1/notifications/read/all`

Mark all as read for current user.

### `POST /api/v1/notifications/read/:notificationId`

Mark one as read. 404 if not found, 403 if not owned.

## 10. Admin (super-admin only)

All admin routes use `router.use(protect, authorizeRole(ROLES.SUPER_ADMIN))`.

### `GET /api/v1/admin/overview`

- **Response 200**: `{ success: true, data: { users: {students, outletAdmins, outletStaff, superAdmins, total}, outlets: {total, open, busy, closed, pending, suspended}, menu: {total, available, unavailable}, orders: {total, pending, accepted, preparing, ready, completed, rejected, cancelled} } }`

### `GET /api/v1/admin/users?page=1&pageSize=50`

- **Response 200**: `{ success: true, data: { items: User[], total, page, pageSize } }`

### `GET /api/v1/admin/users/:userId`

Include outletStaff + studentProfile.

### `PATCH /api/v1/admin/users/:userId/status`

- **Body**: `{ status: "ACTIVE"|"SUSPENDED" }`
- **Errors**: 400 (cannot suspend self), 404
- **Side effects**: On suspend → `revokeAllForUser(userId)` revokes all refresh tokens; AuditLog (`USER_STATUS_CHANGED`)

### `GET /api/v1/admin/outlets` / `GET /api/v1/admin/outlets/:outletId`

### `PATCH /api/v1/admin/outlets/:outletId/status`

- **Body**: `{ status: "OPEN"|"BUSY"|"CLOSED"|"PENDING"|"SUSPENDED" }`

### `GET /api/v1/admin/orders?page=1&pageSize=100` / `GET /api/v1/admin/orders/:orderId`

Platform-wide order view.

### `GET /api/v1/admin/menu` / `GET /api/v1/admin/menu/:itemId`

### `PATCH /api/v1/admin/menu/:itemId/status`

- **Body**: `{ isAvailable: boolean }`

## 11. Audit log (super-admin only)

### `GET /api/v1/audit?page=1&pageSize=50&targetType=Order&targetId=...&actorUserId=...&action=...`

- **Response 200**: `{ success: true, data: { items: AuditLog[], total, page, pageSize } }`

## 12. Error codes

| Code                     | HTTP | When                                          |
|--------------------------|------|-----------------------------------------------|
| `VALIDATION_ERROR`        | 400  | Zod schema rejected body/query                 |
| `UNAUTHORIZED`           | 401  | Missing/invalid token, user not found          |
| `ACCOUNT_SUSPENDED`      | 401  | User's `status === 'SUSPENDED'`                |
| `FORBIDDEN`              | 403  | Role not allowed, not outlet-scoped            |
| `NOT_FOUND`              | 404  | Resource not found                              |
| `CONFLICT`               | 409  | Email already registered, already onboarded    |
| `INVALID_TRANSITION`     | 400  | Disallowed order status transition             |
| `OUTLET_CLOSED`          | 400  | Outlet is CLOSED/SUSPENDED, can't accept orders |
| `ITEM_UNAVAILABLE`       | 400  | Menu item marked unavailable                    |
| `PAYMENT_REQUIRED`       | 400  | Order payment not yet PAID; can't transition    |
| `PAYMENT_FAILED`         | 400  | Razorpay signature verification failed          |
| `RATE_LIMIT_EXCEEDED`    | 429  | Rate limit hit                                  |
| `INTERNAL_ERROR`         | 500  | Unhandled server error                          |
