# Nosh API — M3 Contracts (Realtime + Notifications)

> Spec ref: §6.2 State Management, §11 risk matrix (network fallback)
> Status: Implemented (apps/backend/src/lib/socket.js, apps/backend/src/modules/notifications/)

## 1. Socket.IO connection

### Client → Server handshake

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('accessToken') },
  transports: ['websocket', 'polling'],  // long-polling fallback first
});
```

The server middleware (`src/lib/socket.js`) verifies the access token, looks up the live user record, and joins the socket to rooms:

| Room                       | Joined when                                          |
|----------------------------|------------------------------------------------------|
| `user:<userId>`             | Always (every user has their own room)               |
| `outlet:<outletId>`         | User is OUTLET_STAFF or OUTLET_ADMIN for this outlet |
| `super-admin`               | User role is SUPER_ADMIN                              |

### Long-polling fallback

College networks that block WebSocket upgrades (especially during exam week) silently downgrade to HTTP long-polling. The `transports: ['websocket', 'polling']` option makes this automatic — no client code changes needed.

Per spec §11 risk matrix mitigation: "also REST polling fallback every 30s as last resort" — the frontend's TanStack Query can be configured to refetch every 30s as a backup.

## 2. Events

### Server → Client: `order:new`

Emitted to room `outlet:<outletId>` when an order's Payment.status transitions to PAID.

```js
// Payload
{
  order: { id, orderNumber, status, totalAmount, items: [...], outletId, studentId, ... }
}
```

Frontend action: invalidate TanStack Query cache key `['orders', 'outlet', 'list']` to refetch the outlet's incoming orders.

### Server → Client: `order:status:changed`

Emitted to both `outlet:<outletId>` AND `student:<userId>` rooms when the outlet transitions the order's status.

```js
// Payload
{ order: { ...full order with items, payment } }
```

Frontend action:
- Outlet dashboard: invalidate `['orders', 'outlet', 'list']` and `['orders', 'detail', orderId]`
- Student tracking page: invalidate `['orders', 'student', 'list']` and `['orders', 'detail', orderId]`

### Server → Client: `notification:created`

Emitted to `user:<userId>` when a new `Notification` row is created.

```js
// Payload: the full Notification row
{ id, userId, type, title, message, payload, isRead, orderId, createdAt }
```

Frontend action: invalidate `['notifications', 'list']`; increment the unread badge.

## 3. Critical: events fire AFTER DB commits

Per spec §2 principle 3:

> "Realtime events reflect persisted state; if the event and the DB disagree, the DB wins. Realtime is never used to skip persistence."

Implementation: `orders.controller.updateOrderStatus` calls the Prisma transaction first (the service layer's `updateOrderStatus`), then calls `emitOrderEvent()` only if the transaction succeeded. If the DB write throws, the catch in the controller forwards to `next(error)` and no event is emitted.

## 4. Notification types

| Type                | When emitted                                          | Title              | Message template                                    |
|---------------------|-------------------------------------------------------|--------------------|------------------------------------------------------|
| `ORDER_ACCEPTED`    | Order transitions to `ACCEPTED`                        | "Order accepted"   | `${outletSnapshot.name} accepted your order ${orderNumber}.` |
| `ORDER_PREPARING`   | Order transitions to `PREPARING`                       | "Preparing"        | `Your order ${orderNumber} is being prepared.`       |
| `ORDER_READY`       | Order transitions to `READY`                           | "Ready for pickup" | `Order ${orderNumber} is ready. Use pickup code ${pickupCode}.` |
| `ORDER_COMPLETED`   | Order transitions to `COMPLETED`                       | "Order completed"  | `Order ${orderNumber} is completed. Thank you!`     |
| `ORDER_REJECTED`    | Order transitions to `REJECTED`                        | "Order rejected"   | `Order ${orderNumber} was rejected. A full refund will be issued.` |
| `ORDER_CANCELLED`   | Order transitions to `CANCELLED`                       | "Order cancelled"  | `Order ${orderNumber} was cancelled.`               |

## 5. REST API for notifications

### `GET /api/v1/notifications?page=1&pageSize=20&unread=true`

- **Auth**: any
- **Query**: `page`, `pageSize`, `unread` (`"true"`/`"false"`)
- **Response 200**: `{ success: true, data: { items: Notification[], total, unreadCount, page, pageSize } }`

### `POST /api/v1/notifications/read/:notificationId`

- Marks one notification as read
- **Errors**: 403 (not your notification), 404

### `POST /api/v1/notifications/read/all`

- Marks all unread notifications for the user as read
- **Response 200**: `{ success: true, data: { marked: number } }`

## 6. Frontend invalidation strategy (TanStack Query)

Per spec §6.2:

```ts
// On order:status:changed event
socket.on('order:status:changed', ({ order }) => {
  queryClient.invalidateQueries({ queryKey: ['orders', 'detail', order.id] });
  queryClient.invalidateQueries({ queryKey: ['orders', 'outlet', 'list'] });
  queryClient.invalidateQueries({ queryKey: ['orders', 'student', 'list'] });
});

// On notification:created
socket.on('notification:created', () => {
  queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
});

// On order:new (outlet dashboard)
socket.on('order:new', () => {
  queryClient.invalidateQueries({ queryKey: ['orders', 'outlet', 'list'] });
});
```

## 7. Connection lifecycle

- On connect: server logs `[socket.io] connected: user=... role=... outlet=...`
- On disconnect: server logs `[socket.io] disconnected: user=...`
- On auth failure: server sends `Authentication failed` error → client receives `connect_error` event
- On suspended user: connection is rejected at handshake (`Account suspended`)
- On token expiry mid-session: client must reconnect with a fresh access token (obtained via `/auth/refresh`)
